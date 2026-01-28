const { spawn } = require('child_process');
const path = require('path');

console.log('🔧 Starting SentinelOps Backend Service...\n');

// Check if dependencies are installed
const fs = require('fs');
const nodeModulesPath = path.join(__dirname, 'node_modules');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing dependencies...');
  const installProcess = spawn('npm', ['install'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  installProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Dependencies installed successfully');
      startBackend();
    } else {
      console.error('❌ Failed to install dependencies');
      process.exit(1);
    }
  });
} else {
  startBackend();
}

function startBackend() {
  console.log('🚀 Starting backend server...\n');
  
  const backendProcess = spawn('npm', ['start'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    process.exit(code);
  });

  backendProcess.on('error', (error) => {
    console.error('❌ Failed to start backend:', error.message);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping backend service...');
    backendProcess.kill('SIGINT');
    setTimeout(() => {
      console.log('👋 Backend stopped. Goodbye!');
      process.exit(0);
    }, 1000);
  });
}
