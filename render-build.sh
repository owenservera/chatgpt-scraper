#!/bin/bash
set -e

echo "Installing Node.js dependencies..."
npm install

echo "Installing Puppeteer browser..."
# This command downloads Chromium into the directory specified by puppeteer.config.cjs
npx puppeteer browsers install chrome

echo "Build completed successfully!"