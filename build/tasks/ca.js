/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const gulp = require('gulp');
const debug = require('gulp-debug');

const DEPS = [
	'fabric-client/lib/utils.js',
	'fabric-client/lib/BaseClient.js',
	'fabric-client/lib/Remote.js',
	'fabric-client/lib/User.js',
	'fabric-client/lib/impl/bccsp_pkcs11.js',
	'fabric-client/lib/impl/CouchDBKeyValueStore.js',
	'fabric-client/lib/impl/CryptoSuite_ECDSA_AES.js',
	'fabric-client/lib/impl/aes/*',
	'fabric-client/lib/impl/ecdsa/*',
	'fabric-client/lib/impl/CryptoKeyStore.js',
	'fabric-client/lib/impl/FileKeyValueStore.js',
	'fabric-client/lib/msp/msp.js',
	'fabric-client/types/tsconfig.json',
	'fabric-client/types/base.d.ts'
];

gulp.task('ca', () => {
	return gulp.src(DEPS, {base: 'fabric-client/'})
		.pipe(debug())
		.pipe(gulp.dest('fabric-ca-client/'))
		.pipe(gulp.dest('node_modules/fabric-ca-client'));
});

module.exports.DEPS = DEPS;
