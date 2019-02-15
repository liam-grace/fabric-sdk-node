/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Transaction = require('fabric-network/lib/transaction');
const ContractEventListener = require('./impl/event/contracteventlistener');
const BlockEventListener = require('./impl/event/blockeventlistener');
const TransactionEventListener = require('./impl/event/transactioneventlistener');

const logger = require('./logger').getLogger('Contract');
const util = require('util');

/**
 * Ensure transaction name is a non-empty string.
 * @private
 * @param {*} name Transaction name.
 * @throws {Error} if the name is invalid.
 */
function verifyTransactionName(name) {
	if (typeof name !== 'string' || name.length === 0) {
		const msg = util.format('Transaction name must be a non-empty string: %j', name);
		logger.error('verifyTransactionName:', msg);
		throw new Error(msg);
	}
}

/**
 * Ensure that, if a namespace is defined, it is a non-empty string
 * @private
 * @param {*} namespace Transaction namespace.
 * @throws {Error} if the namespace is invalid.
 */
function verifyNamespace(namespace) {
	if (namespace && typeof namespace !== 'string') {
		const msg = util.format('Namespace must be a non-empty string: %j', namespace);
		logger.error('verifyNamespace:', msg);
		throw new Error(msg);
	}
}

/**
 * Represents a smart contract (chaincode) instance in a network.
 * Applications should get a Contract instance using the
 * networks's [getContract]{@link module:fabric-network.Network#getContract} method.
 * @memberof module:fabric-network
 * @hideconstructor
 */
class Contract {
	constructor(network, chaincodeId, gateway, checkpointer, namespace) {
		logger.debug('in Contract constructor');

		verifyNamespace(namespace);

		this.network = network;
		this.channel = network.getChannel();
		this.chaincodeId = chaincodeId;
		this.gateway = gateway;
		this.namespace = namespace;

		this.checkpointer = checkpointer;
		this.listeners = new Map();
	}

	/**
	 * Get the parent network on which this contract exists.
	 * @private
	 * @returns {Network} A network.
	 */
	getNetwork() {
		return this.network;
	}

	/**
	 * Create a new transaction ID.
	 * @private
	 * @returns {module:fabric-client.TransactionID} Transaction ID.
	 */
	createTransactionID() {
		return this.gateway.getClient().newTransactionID();
	}

	/**
	 * Get the chaincode ID of this contract.
	 * @private
	 * @returns {String} Chaincode ID.
	 */
	getChaincodeId() {
		return this.chaincodeId;
	}

	getCheckpointer(options) {
		if (options) {
			if (typeof options.checkpointer === 'undefined') {
				return this.checkpointer;
			} else if (options.checkpointer) {
				return options.checkpointer;
			} else if (options.checkpointer === false) {
				return null;
			}
		}
		return this.checkpointer;
	}

	getEventHubSelectionStrategy() {
		return this.network.eventHubSelectionStrategy;
	}

	/**
	 * Get event handler options specified by the user when creating the gateway.
	 * @private
	 * @returns {Object} Event handler options.
	 */
	getEventHandlerOptions() {
		return this.gateway.getOptions().eventHandlerOptions;
	}

	/**
	 * Create an object representing a specific invocation of a transaction
	 * function implemented by this contract, and provides more control over
	 * the transaction invocation. A new transaction object <strong>must</strong>
	 * be created for each transaction invocation.
     * @param {String} name Transaction function name.
	 * @returns {module:fabric-network.Transaction} A transaction object.
     */
	createTransaction(name) {
		verifyTransactionName(name);

		const qualifiedName = this._getQualifiedName(name);
		const transaction = new Transaction(this, qualifiedName);

		const eventHandlerStrategy = this.getEventHandlerOptions().strategy;
		if (eventHandlerStrategy) {
			transaction.setEventHandlerStrategy(eventHandlerStrategy);
		}

		return transaction;
	}

	_getQualifiedName(name) {
		return (this.namespace ? `${this.namespace}:${name}` : name);
	}

	dispose() {
		this.listeners.forEach(listener => listener.unregister());
	}

	/**
	 * Submit a transaction to the ledger. The transaction function <code>name</code>
	 * will be evaluated on the endorsing peers and then submitted to the ordering service
	 * for committing to the ledger.
	 * This function is equivalent to calling <code>createTransaction(name).submit()</code>.
	 * @async
     * @param {string} name Transaction function name.
	 * @param {...string} [args] Transaction function arguments.
	 * @returns {Buffer} Payload response from the transaction function.
	 * @throws {module:fabric-network.TimeoutError} If the transaction was successfully submitted to the orderer but
	 * timed out before a commit event was received from peers.
     */
	async submitTransaction(name, ...args) {
		return this.createTransaction(name).submit(...args);
	}

	/**
	 * Evaluate a transaction function and return its results.
	 * The transaction function <code>name</code>
	 * will be evaluated on the endorsing peers but the responses will not be sent to
	 * the ordering service and hence will not be committed to the ledger.
	 * This is used for querying the world state.
	 * This function is equivalent to calling <code>createTransaction(name).evaluate()</code>.
	 * @async
     * @param {string} name Transaction function name.
     * @param {...string} [args] Transaction function arguments.
     * @returns {Buffer} Payload response from the transaction function.
     */
	async evaluateTransaction(name, ...args) {
		return this.createTransaction(name).evaluate(...args);
	}

	addContractListener(listenerName, eventName, callback, options = {}) {
		options.checkpointer = this.getCheckpointer(options);
		const listener = new ContractEventListener(this, listenerName, eventName, callback, options);
		this.listeners.set(listenerName, listener);
		listener.register();
		return listener;
	}

	addBlockListener(listenerName, callback, options = {}) {
		options.checkpointer = this.getCheckpointer(options);
		const listener = new BlockEventListener(this, listenerName, callback, options);
		this.listeners.set(listenerName, listener);
		listener.register();
		return listener;
	}

	addTransactionListener(transactionId, callback, options = {}, eventHub) {
		options.checkpointer = null;
		const listener = new TransactionEventListener(this, transactionId, callback, options);
		listener.setEventHub(eventHub);
		this.listeners.set(transactionId, listener);
		listener.register();
		return listener;
	}
}

module.exports = Contract;
