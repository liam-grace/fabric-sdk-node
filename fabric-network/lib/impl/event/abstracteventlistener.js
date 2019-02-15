/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const Long = require('long');

class AbstractEventListener {
	constructor(contract, listenerName, eventCallback, options = {}) {
		this.contract = contract;
		this.listenerName = listenerName;
		this.eventCallback = eventCallback;
		this.options = options;
		this.checkpointer = this.options.checkpointer;

		this._registered = false;
		this._firstCheckpoint = {};
		this._registration = null;
	}

	register() {
		if (this._registered) {
			throw new Error('Listener already registered');
		}

		let checkpoint;

		if (this.checkpointer) {
			this.checkpointer.initialize(this.contract.getChaincodeId(), this.listenerName);
			this._firstCheckpoint = checkpoint = this.checkpointer.load(this.contract.getChaincodeId(), this.listenerName);
			this.options.startBlock = Long.fromValue(checkpoint.blockNumber);
		}
	}

	unregister() {
		this._registered = false;
		delete this.options.startBlock;
		delete this.options.endBlock;
		delete this.options.disconnect;
		this._firstCheckpoint = {};
	}

	isregistered() {
		return this._registered;
	}

	getCheckpointer() {
		return this.checkpointer;
	}

	hasCheckpointer() {
		return !!this.checkpointer;
	}

	getEventHubManager() {
		const network = this.contract.getNetwork();
		return network.getEventHubManager();
	}

	_disconnectEventHub() {
		if (!this.eventHub) {
			// Log no event hub given
			return;
		}
		if (this.eventHub.isconnected()) {
			this.eventHub.disconnect();
		}
	}

	_isShutdownMessage(error) {
		if (error) {
			return error.message === 'ChannelEventHub has been shutdown';
		}
		return false;
	}
}

module.exports = AbstractEventListener;
