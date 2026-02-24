// src/utils/errorHandler.ts
// Global error handler to catch Event objects and other unhandled errors

interface GlobalErrorHandler {
  init: () => void;
  handleEventError: (event: ErrorEvent) => void;
  handleUnhandledRejection: (event: PromiseRejectionEvent) => void;
}

const globalErrorHandler: GlobalErrorHandler = {
  init() {
    // Handle uncaught errors (including Event objects)
    window.addEventListener('error', this.handleEventError);
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  },

  handleEventError(event: ErrorEvent) {
    console.error('❌ Global error handler caught:', event);
    
    // Check if the error is an Event object
    if (event.error instanceof Event) {
      console.error('❌ Event object caught globally:', event.error);
      
      // Create a proper error from the Event
      const properError = new Error(`Event object error: ${event.error.type}`);
      properError.stack = `Event type: ${event.error.type}, Event target: ${event.error.target}`;
      
      // Prevent the default error handling
      event.preventDefault();
      
      // Log the proper error
      console.error('❌ Converted Event to Error:', properError);
      
      return;
    }
    
    // Handle other types of errors
    console.error('❌ Regular error caught:', event.error);
  },

  handleUnhandledRejection(event: PromiseRejectionEvent) {
    console.error('❌ Unhandled promise rejection:', event);
    
    // Check if the reason is an Event object
    if (event.reason instanceof Event) {
      console.error('❌ Event object in promise rejection:', event.reason);
      
      // Create a proper error from the Event
      const properError = new Error(`Event object rejection: ${event.reason.type}`);
      properError.stack = `Event type: ${event.reason.type}, Event target: ${event.reason.target}`;
      
      // Prevent the default rejection handling
      event.preventDefault();
      
      // Log the proper error
      console.error('❌ Converted Event rejection to Error:', properError);
      
      return;
    }
    
    console.error('❌ Regular promise rejection:', event.reason);
  }
};

// Initialize the global error handler
if (typeof window !== 'undefined') {
  globalErrorHandler.init();
}

export default globalErrorHandler;
