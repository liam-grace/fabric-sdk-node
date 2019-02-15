/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const os = require('os');
const path = require('path');
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const rewire = require('rewire');
const FileSystemCheckpointer = rewire('fabric-network/lib/impl/event/filesystemcheckpointer');

class MockMmap {

}

describe('FileSystemCheckpointer', () => {
	let sandbox;
	let pathStub;
	let osStub;
	let checkpointer;

	before(() => {
		sandbox = sinon.createSandbox();
		pathStub = sandbox.stub(path);
		osStub = sandbox.stub(os);
		FileSystemCheckpointer.__set__('path', pathStub);
		FileSystemCheckpointer.__set__('os', osStub);
	});

	beforeEach(() => {
		sandbox = sinon.createSandbox();

		pathStub.join.returns('apath');
		osStub.homedir.returns('homedir');
		path.resolve = (a) => a;
		checkpointer = new FileSystemCheckpointer();
	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#constructor', () => {
		it('should set basePath without options', () => {
			const check = new FileSystemCheckpointer();
			sinon.assert.called(osStub.homedir);
			sinon.assert.calledWith(pathStub.join, 'homedir', '/.hlf-checkpoint');
			expect(check._basePath).to.equal('apath');
			expect(check.mmapObjects).to.be.instanceOf(Map);
		});

		it('should set basePath with options', () => {
			const check = new FileSystemCheckpointer({basePath: 'somepath'});
			sinon.assert.called(osStub.homedir);
			sinon.assert.calledWith(pathStub.join, 'homedir', '/.hlf-checkpoint');
			expect(check._basePath).to.equal('somepath');
			expect(check.mmapObjects).to.be.instanceOf(Map);
		});
	});

	describe('#initialize', () => {
		let fsStub;
		let mmapStub;
		beforeEach(() => {
			fsStub = sandbox.stub({ensureDirSync() {}});
			FileSystemCheckpointer.__set__('fs', fsStub);
			mmapStub = {
				Create: MockMmap
			};
			FileSystemCheckpointer.__set__('mmap', mmapStub);
		});

		it('should initialize the mmap object and add it to the Map', () => {
			checkpointer.initialize('chaincodeid', 'testlistener');
			sinon.assert.calledWith(path.join, 'apath', 'chaincodeid');
			sinon.assert.calledWith(fsStub.ensureDirSync, 'apath');
			const mmapObject = checkpointer.mmapObjects.get('chaincodeidtestlistener');
			expect(mmapObject).to.be.instanceof(MockMmap);
		});

		it('should initialize the mmap object and add it to the Map if create throws', () => {
			checkpointer.initialize('chaincodeid', 'testlistener');
			sinon.assert.calledWith(path.join, 'apath', 'chaincodeid');
			sinon.assert.calledWith(fsStub.ensureDirSync, 'apath');
			const mmapObject = checkpointer.mmapObjects.get('chaincodeidtestlistener');
			mmapStub.create = () => {
				throw new Error('Forced error');
			};
			expect(mmapObject).to.be.instanceof(MockMmap);
		});
	});

	describe('#save', () => {
		let chaincodeId;
		let listenerName;
		let objectName;
		beforeEach(() => {
			chaincodeId = 'chaincodeid';
			listenerName = 'testlistener';
			objectName = `${chaincodeId}${listenerName}`;
		});

		it('should update an existing mmap object', () => {
			checkpointer.mmapObjects.set(objectName, {blockNumber: 0, transactionIds: JSON.stringify(['transactionId'])});
			checkpointer.save(chaincodeId, listenerName, 'transactionId1', 0);
			const object = checkpointer.mmapObjects.get(objectName);
			expect(object).to.deep.equal({blockNumber: 0, transactionIds: JSON.stringify(['transactionId', 'transactionId1'])});
		});

		it('should update an existing mmap object when blockNumber changes', () => {
			checkpointer.mmapObjects.set(objectName, {blockNumber: 0, transactionIds: JSON.stringify(['transactionId'])});
			checkpointer.save(chaincodeId, listenerName, 'transactionId', 1);
			const object = checkpointer.mmapObjects.get(objectName);
			expect(object).to.deep.equal({blockNumber: 1, transactionIds: JSON.stringify(['transactionId'])});
		});
	});

	describe('#load', () => {
		let chaincodeId;
		let listenerName;
		let objectName;
		beforeEach(() => {
			chaincodeId = 'chaincodeid';
			listenerName = 'testlistener';
			objectName = `${chaincodeId}${listenerName}`;
		});

		it('should return the checkpoint', () => {
			const checkpoint = {blockNumber: 0, transactionIds: JSON.stringify([])};
			checkpointer.mmapObjects.set(objectName, checkpoint);
			const loadedCheckpoint = checkpointer.load(chaincodeId, listenerName);
			expect(loadedCheckpoint).to.not.equal(checkpoint);
			expect(loadedCheckpoint.blockNumber).to.equal(0);
			expect(loadedCheckpoint.transactionIds).to.equal('"[]"');
		});

		it('should return an empty object if an error is thrown', () => {
			const checkpoint = null;
			checkpointer.mmapObjects.set(objectName, checkpoint);
			const loadedCheckpoint = checkpointer.load(chaincodeId, listenerName);
			expect(loadedCheckpoint).to.deep.equal({});
		});
	});
});
