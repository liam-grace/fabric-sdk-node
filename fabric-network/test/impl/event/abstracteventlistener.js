/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const ChannelEventHub = require('fabric-client/lib/ChannelEventHub');
const Contract = require('./../../../lib/contract');
const Network = require('./../../../lib/network');
const EventHubManager = require('./../../../lib/impl/event/eventhubmanager');
const AbstractEventListener = require('./../../../lib/impl/event/abstracteventlistener');
const FileSystemCheckpointer = require('./../../../lib/impl/event/filesystemcheckpointer');

describe('AbstractEventListner', () => {
	let sandbox;

	let testListener;
	let contractStub;
	let networkStub;
	let checkpointerStub;
	let eventHubManagerStub;
	beforeEach(() => {
		sandbox = sinon.createSandbox();

		eventHubManagerStub = sandbox.createStubInstance(EventHubManager);
		contractStub = sandbox.createStubInstance(Contract);
		networkStub = sandbox.createStubInstance(Network);
		networkStub.getEventHubManager.returns(eventHubManagerStub);
		contractStub.getNetwork.returns(networkStub);
		checkpointerStub = sandbox.createStubInstance(FileSystemCheckpointer);

		contractStub.getChaincodeId.returns('ccid');
		const callback = (err) => {};
		testListener = new AbstractEventListener(contractStub, 'testListener', callback, {option: 'anoption'});

	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#constructor', () => {
		it('should set the correct properties on instantiation', () => {
			const callback = (err) => {};
			const listener = new AbstractEventListener(contractStub, 'testlistener', callback, {option: 'anoption'});
			expect(listener.contract).to.equal(contractStub);
			expect(listener.listenerName).to.equal('testlistener');
			expect(listener.eventCallback).to.equal(callback);
			expect(listener.options).to.deep.equal({option: 'anoption'});
			expect(listener.checkpointer).to.be.undefined;
			expect(listener._registered).to.be.false;
			expect(listener._firstCheckpoint).to.deep.equal({});
			expect(listener._registration).to.be.null;
		});
	});

	describe('#register', () => {
		it('should throw if the listener is already registered', () => {
			testListener._registered = true;
			expect(() => testListener.register()).to.throw('Listener already registered');
		});

		it('should not call checkpointer.initialize() or checkpointer.load()', () => {
			testListener.register();
			sinon.assert.notCalled(checkpointerStub.initialize);
			sinon.assert.notCalled(checkpointerStub.load);
		});

		it('should not call checkpointer.initialize()', () => {
			const checkpoint = {transactionId: 'txid', blockNumber: '10'};
			checkpointerStub.load.returns(checkpoint);
			testListener.checkpointer = checkpointerStub;
			testListener.register();
			sinon.assert.calledWith(checkpointerStub.initialize, 'ccid', testListener.listenerName);
			sinon.assert.calledWith(checkpointerStub.load, 'ccid', testListener.listenerName);
			expect(testListener.options.startBlock.toNumber()).to.equal(10); // Start block is a Long
			expect(testListener._firstCheckpoint).to.deep.equal(checkpoint);
		});
	});

	describe('#unregister', () => {
		beforeEach(() => {
			checkpointerStub.load.returns({transactionId: 'txid', blockNumber: '10'});
			testListener.checkpointer = checkpointerStub;
			testListener.register();
		});
		it('should reset the correct variables', () => {
			testListener.unregister();
			expect(testListener._registered).to.be.false;
			expect(testListener.startBlock).to.be.undefined;
			expect(testListener.options.endBlock).to.be.undefined;
			expect(testListener._firstCheckpoint).to.deep.equal({});
		});
	});

	describe('#isRegistered', () => {
		it('should return false if the listener has not been registered', () => {
			expect(testListener.isregistered()).to.be.false;
		});

		// Abstract listener does not change the register status
		it('should return false if the listener has been registered', () => {
			testListener.register();
			expect(testListener.isregistered()).to.be.false;
		});

		it('should return false if registered and unregistered', () => {
			testListener.register();
			testListener.unregister();
			expect(testListener.isregistered()).to.be.false;
		});
	});

	describe('#getCheckpointer', () => {
		it('should return undefined if checkpointer has not been set', () => {
			expect(testListener.getCheckpointer()).to.be.undefined;
		});

		it('should return the checkpointer if it has been set', () => {
			testListener.checkpointer = checkpointerStub;
			expect(testListener.getCheckpointer()).to.equal(checkpointerStub);
		});
	});

	describe('#hasCheckpointer', () => {
		it('should return false if checkpointer has not been set', () => {
			expect(testListener.hasCheckpointer()).to.be.false;
		});

		it('should return true if it has been set', () => {
			testListener.checkpointer = checkpointerStub;
			expect(testListener.hasCheckpointer()).to.be.true;
		});
	});

	describe('#getEventHubManager', () => {
		it('shouild return the event hub manager from the network', () => {
			expect(testListener.getEventHubManager()).to.equal(eventHubManagerStub);
		});
	});

	describe('_disconnectEventHub', () => {
		let eventHubStub;
		beforeEach(() => {
			eventHubStub = sandbox.createStubInstance(ChannelEventHub);
		});

		it('should not call disconnect or isconnected if no event hub is given', () => {
			testListener._disconnectEventHub();
			sinon.assert.notCalled(eventHubStub.isconnected);
			sinon.assert.notCalled(eventHubStub.disconnect);
		});

		it('should call isconnected and not disconnect if the event hub is not connected', () => {
			eventHubStub.isconnected.returns(false);
			testListener.eventHub = eventHubStub;
			testListener._disconnectEventHub();
			sinon.assert.called(eventHubStub.isconnected);
			sinon.assert.notCalled(eventHubStub.disconnect);
		});

		it('should call isconnected and disconnect if the event hub is connected', () => {
			eventHubStub.isconnected.returns(true);
			testListener.eventHub = eventHubStub;
			testListener._disconnectEventHub();
			sinon.assert.called(eventHubStub.isconnected);
			sinon.assert.called(eventHubStub.disconnect);
		});
	});

	describe('#_isShutdownMessage', () => {
		it('should return false if an error is not given', () => {
			expect(testListener._isShutdownMessage()).to.be.false;
		});

		it('should return false if error message does not match', () => {
			expect(testListener._isShutdownMessage(new Error('An error'))).to.be.false;
		});

		it('should return true if the error message does match', () => {
			expect(testListener._isShutdownMessage(new Error('CHannelEventHub has been shutdown'))).to.be.false;
		});
	});
});
