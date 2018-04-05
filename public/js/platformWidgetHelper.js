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
      callback({ 
        context_type: 'Incident', 
        context_id: 23529800,
        name: 'Harvest Project',
        description: 'Testing Harvest integration', 
        assignee: {
          group_id: 3031154,
          name: 'Devin'
        },
        requester: {
          user_id: 2821593,
          name: 'Devin'
        }
      })
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