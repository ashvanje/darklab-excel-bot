$('#submitBtn').on('click', function() {
    // $(this).prop('disabled', true);
    $('#loadingIcon').show();
    $('#progressContainer .progress').show();


    let fileUpload = $('#fileUpload')[0].files[0];
    let template = $('#templateArea').val();
    let formData = new FormData();
    formData.append('file', fileUpload);
    formData.append('template', template);
  
    $.ajax({
      url: '/api/process',
      type: 'POST',
      data: formData,
      contentType: false,
      processData: false,
      success: function(data) {
        console.log('File processing started.');
      }
    });
  });
  
  $('#downloadBtn').on('click', function() {
    window.location.href = '/api/download';
  });

// const hostname = window.location.hostname;
// const port = window.location.port;
  
// const ws = new WebSocket(`ws://${hostname}:${port}`);

// ws.onmessage = (event) => {
//   const data = JSON.parse(event.data);
//   const progress = data.progress;

//   // Update progress bar
//   const progressBar = document.getElementById('progressBar');
//   progressBar.style.width = progress + '%';
//   progressBar.innerText = progress + '%';
// };

// script.js
fetch('/websocket-url')
  .then((response) => response.json())
  .then((data) => {
    const websocketUrl = data.websocketUrl;
    const ws = new WebSocket(websocketUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const progress = data.progress;

      // Update progress bar
      const progressBar = document.getElementById('progressBar');
      progressBar.style.width = progress + '%';
      progressBar.innerText = progress + '%';
      if (progress == 100) {
        $('#loadingIcon').hide();
      }
    };
  })
  .catch((error) => {
    console.error('Error retrieving WebSocket URL:', error);
  });
