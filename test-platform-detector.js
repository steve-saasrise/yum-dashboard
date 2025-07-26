// Test script to verify PlatformDetector behavior
import { PlatformDetector } from './lib/platform-detector.js';

const testUrls = [
  'https://x.com/elonmusk',
  'https://twitter.com/elonmusk',
  'https://www.x.com/elonmusk',
  'https://x.com/@elonmusk',
];

console.log('Testing Platform Detection:\n');

testUrls.forEach((url) => {
  try {
    const result = PlatformDetector.detect(url);
    console.log(`URL: ${url}`);
    console.log(`Platform: ${result.platform}`);
    console.log(`Platform User ID: ${result.platformUserId}`);
    console.log(`Profile URL: ${result.profileUrl}`);
    console.log('---');
  } catch (error) {
    console.log(`URL: ${url}`);
    console.log(`Error: ${error.message}`);
    console.log('---');
  }
});
