const fs = require('fs');
const path = require('path');

// Read the .env file
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Create the build directory if it doesn't exist
const buildDir = path.resolve(__dirname, '../build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

// Write the environment variables to a file that can be included in the build
fs.writeFileSync(
  path.resolve(buildDir, 'env.js'),
  `window._env_ = ${JSON.stringify(
    envContent
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, value] = line.split('=');
        if (key && value) {
          acc[key.trim()] = value.trim();
        }
        return acc;
      }, {})
  )};`
); 