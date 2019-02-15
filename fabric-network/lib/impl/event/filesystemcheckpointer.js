/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const BaseCheckpointer = require('./basecheckpointer');
const mmap = require('mmap-object');
const logger = require('fabric-network/lib/logger').getLogger('FileSystemCheckpointer');


class FileSystemCheckpointer extends BaseCheckpointer {
	constructor(options = {}) {
		super(options);
		this.fileExists = false;
		if (!options.basePath) {
			options.basePath = path.join(os.homedir(), '/.hlf-checkpoint');
		}
		this._basePath = path.resolve(options.basePath); // Ensure that this path is correct

		this.mmapObjects = new Map();
	}

	initialize(chaincodeId, listenerName) {
		const fileName = this._getCheckpointFileName(chaincodeId, listenerName);
		fs.ensureDirSync(path.join(this._basePath, chaincodeId));
		let mmapObject;
		try {
			mmapObject = new mmap.Create(fileName);
		} catch (err) {
			mmapObject = new mmap.Create(fileName);
		}
		this.mmapObjects.set(`${chaincodeId}${listenerName}`, mmapObject);
	}

	save(chaincodeId, listenerName, transactionId, blockNumber) {
		const mmapObject = this.mmapObjects.get(`${chaincodeId}${listenerName}`);
		if (Number(blockNumber) === Number(mmapObject.blockNumber)) {
			const transactionIds = JSON.parse(mmapObject.transactionIds);
			transactionIds.push(transactionId);
			mmapObject.transactionIds = JSON.stringify(transactionIds);
		} else {
			mmapObject.transactionIds = JSON.stringify([transactionId]);
			mmapObject.blockNumber = blockNumber;
		}
	}

	load(chaincodeId, listenerName) {
		const mmapObject = this.mmapObjects.get(`${chaincodeId}${listenerName}`);
		try {
			return {transactionIds: JSON.stringify(mmapObject.transactionIds), blockNumber: Number(mmapObject.blockNumber)};
		} catch (err) {
			// Log error
			logger.error('Could not load checkpoint data');
			return {};
		}
	}

	async _doesCheckpointFileExist(chaincodeId, listenerName) {
		const fileName = this._getCheckpointFileName(chaincodeId, listenerName);
		return fs.exists(fileName);
	}

	async _createCheckpointFile(chaincodeId, listenerName) {
		const fileName = this._getCheckpointFileName(chaincodeId, listenerName);
		return fs.createFile(fileName);
	}

	_getCheckpointFileName(chaincodeId, listenerName) {
		return path.join(this._basePath, chaincodeId, listenerName);
	}
}

module.exports = FileSystemCheckpointer;
