#!/usr/bin/env node

/**
 * Generate a secure random string for use as a session secret
 */
const crypto = require('crypto');

// Generate a secure random string of 64 bytes and convert to hex
const secret = crypto.randomBytes(64).toString('hex');

console.log('Generated SESSION_SECRET:');
console.log(secret);
console.log('\nAdd this to your .env file:');
console.log(`SESSION_SECRET=${secret}`);
