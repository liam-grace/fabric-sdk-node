/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fabprotos = require('fabric-protos');

/*
 * Internal static method to allow transaction envelope to be built without
 * creating a new channel
 */
function buildTransactionProposal(chaincodeProposal, endorsements, proposalResponse) {

	const header = fabprotos.common.Header.decode(chaincodeProposal.getHeader());

	const chaincodeEndorsedAction = new fabprotos.protos.ChaincodeEndorsedAction();
	chaincodeEndorsedAction.setProposalResponsePayload(proposalResponse.payload);
	chaincodeEndorsedAction.setEndorsements(endorsements);

	const chaincodeActionPayload = new fabprotos.protos.ChaincodeActionPayload();
	chaincodeActionPayload.setAction(chaincodeEndorsedAction);

	// the TransientMap field inside the original proposal payload is only meant for the
	// endorsers to use from inside the chaincode. This must be taken out before sending
	// to the orderer, otherwise the transaction will be rejected by the validators when
	// it compares the proposal hash calculated by the endorsers and returned in the
	// proposal response, which was calculated without the TransientMap
	const originalChaincodeProposalPayload = fabprotos.protos.ChaincodeProposalPayload.decode(chaincodeProposal.payload);
	const chaincodeProposalPayloadNoTrans = new fabprotos.protos.ChaincodeProposalPayload();
	chaincodeProposalPayloadNoTrans.setInput(originalChaincodeProposalPayload.input); // only set the input field, skipping the TransientMap
	chaincodeActionPayload.setChaincodeProposalPayload(chaincodeProposalPayloadNoTrans.toBuffer());

	const transactionAction = new fabprotos.protos.TransactionAction();
	transactionAction.setHeader(header.getSignatureHeader());
	transactionAction.setPayload(chaincodeActionPayload.toBuffer());

	const actions = [];
	actions.push(transactionAction);

	const transaction = new fabprotos.protos.Transaction();
	transaction.setActions(actions);


	const payload = new fabprotos.common.Payload();
	payload.setHeader(header);
	payload.setData(transaction.toBuffer());

	return payload;
}



module.exports = {
	buildTransactionProposal
};
