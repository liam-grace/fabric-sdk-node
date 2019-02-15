/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const AbstractEventHubSelectionStrategy = require('./abstracteventhubselectionstrategy');

class RoundRobinEventHubSelectionStrategy extends AbstractEventHubSelectionStrategy {
	constructor(peers = []) {
		super();
		this.peers = new Map();

		peers.forEach((peer) => {
			// Assume peer is alive to begin with
			this.peers.set(peer.getName(), {peer, alive: true});
		});
		this.lastDead = null;
	}

	getNextPeer() {
		let alivePeer;
		this.peers.forEach((peerInfo) => {
			if (!alivePeer && peerInfo.alive) {
				alivePeer = peerInfo.peer;
			}
		});
		if (!alivePeer) {
			this.peers.forEach((peerInfo) => {
				if (!peerInfo.alive && (!this.lastDead || this.lastDead.getName() !== peerInfo.peer.getName())) {
					peerInfo.alive = true;
					this.peers.set(peerInfo.peer.getName(), peerInfo);
				}
			});
			return this.getNextPeer();
		}
		return alivePeer;
	}

	updateEventHubAvailability(deadPeer) {
		this.lastDead = deadPeer;
		if (deadPeer) {
			const peerInfo = this.peers.get(deadPeer.getName());
			peerInfo.alive = false;
			this.peers.set(deadPeer.getName(), peerInfo);
		}
	}
}

module.exports = RoundRobinEventHubSelectionStrategy;
