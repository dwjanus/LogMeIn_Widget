var platformWidgetHelper = (function() {

  var validEventTypes = new Set('*', 'ci_added', 'ci_removed')
  var localStorage

  return {
    show: function() {
      document.getElementById("widget").style.visibility = "visible"
    },

    hide: function() {
      document.getElementById("widget").style.visibility = "hidden"
    },

    getContextObject: function(callback) {
      callback({ context_type: 'Incident', context_id: 23307325 })
    },

    callSamanageAPI: function(callback, HTTPMethod, url, payload) {

    },

    registerToEvents: (eventType, eventCallback) => {
    
    },

    getStorage: (callback) => {
      callback(localStorage);
    },

    setStorage: (callback, storage) => {
      localStorage = storage
      callback(localStorage);
    }
  };
})();