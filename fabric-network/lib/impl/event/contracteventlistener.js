/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const AbstractEventListener = require('./abstracteventlistener');
const logger = require('fabric-network/lib/logger').getLogger('ContractEventListener');
const util = require('util');

class ContractEventListener extends AbstractEventListener {
	constructor(contract, listenerName, eventName, eventCallback, options) {
		super(contract, listenerName, eventCallback, options);
		this.eventName = eventName;
	}

	register() {
		super.register();
		if (!this.eventHub) {
			return this._registerWithNewEventHub();
		}
		this._registration = this.eventHub.registerChaincodeEvent(
			this.contract.getChaincodeId(),
			this.eventName,
			this._onEvent.bind(this),
			this._onError.bind(this),
			this.options
		);
		this._registered = true;
		this.eventHub.connect();
	}

	unregister() {
		super.unregister();
		if (this.eventHub) {
			this.eventHub.unregisterChaincodeEvent(this._registration);
		}
	}

	_onEvent(event, blockNumber, transactionId, status) {
		logger.info('_onEvent:', util.format('success for transaction %s', transactionId));
		blockNumber = Number(blockNumber);

		if (this._firstCheckpoint.transactionIds && this._firstCheckpoint.transactionIds.includes(transactionId)) {
			logger.info(util.format('_onEvent skipped transaction: %s', transactionId));
			return;
		}

		try {
			this.eventCallback(null, event, blockNumber, transactionId, status);
		} catch (err) {
			logger.info(util.format('_onEvent error from callback: %s', err));
		}
		if (this.checkpointer) {
			this.checkpointer.save(this.contract.getChaincodeId(), this.listenerName, transactionId, blockNumber);
		}
		if (this._registration.unregister) {
			this.unregister();
		}
	}

	_onError(error) {
		logger.info('_onError:', util.format('received error from peer %s: %j', this.eventHub.getPeerAddr(), error));
		if (error) {
			if (this._isShutdownMessage(error) && this.isregistered()) {
				this.getEventHubManager().updateEventHubAvailability(this.eventHub._peer);
				this._registerWithNewEventHub();
			}
		}
		this.eventCallback(error);
	}

	_registerWithNewEventHub() {
		this.unregister();
		if (this.checkpointer) {
			this.eventHub = this.getEventHubManager().getReplayEventHub();
		} else {
			this.eventHub = this.getEventHubManager().getEventHub();
		}
		this.register();
	}
}

module.exports = ContractEventListener;
