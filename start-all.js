const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting SentinelOps Full Stack Application...\n');

// Function to start a process and handle output
function startProcess(name, command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`📦 Starting ${name}...`);
    
    const process = spawn(command, args, {
      cwd: cwd,
      stdio: 'pipe',
      shell: true
    });

    process.stdout.on('data', (data) => {
      console.log(`[${name}] ${data.toString().trim()}`);
    });

    process.stderr.on('data', (data) => {
      console.error(`[${name}] ERROR: ${data.toString().trim()}`);
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error(`[${name}] Process exited with code ${code}`);
        reject(new Error(`${name} failed to start`));
      } else {
        console.log(`[${name}] Process completed successfully`);
        resolve();
      }
    });

    process.on('error', (error) => {
      console.error(`[${name}] Failed to start: ${error.message}`);
      reject(error);
    });

    // Handle process termination
    process.on('SIGINT', () => {
      console.log(`\n🛑 Stopping ${name}...`);
      process.kill('SIGINT');
    });

    return process;
  });
}

async function startAll() {
  try {
    // Check if backend directory exists
    const backendPath = path.join(__dirname, 'backend');
    const fs = require('fs');
    
    if (!fs.existsSync(backendPath)) {
      console.error('❌ Backend directory not found. Please ensure the backend folder exists.');
      process.exit(1);
    }

    // Check if backend dependencies are installed
    const packageJsonPath = path.join(backendPath, 'package.json');
    const nodeModulesPath = path.join(backendPath, 'node_modules');
    
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('📦 Installing backend dependencies...');
      await startProcess('Backend Install', 'npm', ['install'], backendPath);
    }

    // Start backend
    console.log('\n🔧 Starting Backend Service...');
    const backendProcess = spawn('npm', ['start'], {
      cwd: backendPath,
      stdio: 'inherit',
      shell: true
    });

    // Wait a bit for backend to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Start frontend
    console.log('\n⚛️ Starting Frontend Application...');
    const frontendProcess = spawn('npm', ['start'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    console.log('\n✅ Both services started successfully!');
    console.log('🌐 Frontend: http://localhost:3000');
    console.log('🔧 Backend:  http://localhost:8000');
    console.log('❤️  Health Check: http://localhost:8000/health');
    console.log('\n🛑 Press Ctrl+C to stop both services');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down services...');
      
      if (backendProcess) {
        backendProcess.kill('SIGINT');
      }
      
      if (frontendProcess) {
        frontendProcess.kill('SIGINT');
      }
      
      setTimeout(() => {
        console.log('👋 All services stopped. Goodbye!');
        process.exit(0);
      }, 2000);
    });

    // Handle process errors
    backendProcess.on('error', (error) => {
      console.error('❌ Backend failed to start:', error.message);
      process.exit(1);
    });

    frontendProcess.on('error', (error) => {
      console.error('❌ Frontend failed to start:', error.message);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start services:', error.message);
    process.exit(1);
  }
}

// Start everything
startAll();
