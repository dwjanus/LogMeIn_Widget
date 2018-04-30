var platformWidgetHelper = (function() {

  var validEventTypes = new Set('*', 'ci_added', 'ci_removed')
  var localStorage

  return {
    show: function() {
      
    },

    hide: function() {
      
    },

    getContextObject: function(callback) {
      callback({ 
        context_type: 'Incident', 
        context_id: 23529800,
        name: 'Harvest Project',
        number: '28',
        description: 'Testing Harvest integration', 
        assignee: {
          user_id: 2821593,
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
      if (payload) payload = JSON.parse(payload)
      fetch('/callExternalApi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: HTTPMethod, url: url, payload: payload })
      }).then((res) => res.text())
        .then((data) => {
          return callback(data)
      }).catch((e) => {
        console.log('\n! >>> Error caught at .catch() in callSamanageAPI(): \n ' + e)
        return callback({error: e})
      })
    },

    getUserInfo: (callback) => {
      callback({ name: 'Devin', user_id: 2821593 })
    },

    registerToEvents: (eventType, eventCallback) => {
    
    },

    getStorage: (callback) => {
      // var id = this.getUserInfo(user => user.user_id) need to fix
      var id = 2821593

      fetch(`/storage/${id}`).then((res) => res.text())
        .then((data) => {
          console.log(`platformWidgetHelper >>> getStorage >> returning data:\n${data}`)
          return callback(data)
        })
      .catch(e => console.log(`>> Error in getStorage: ${e}`))
    },

    setStorage: (callback, storage) => {
      localStorage = storage
      callback(localStorage);
    }
  };
})();