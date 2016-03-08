$(function() {
  $("#password").keyup(function(event){
    if(event.keyCode == 13){
      decrypt();
    }
  });
});

function decrypt() {
  var password = $('#password').val();
  var content = cipherText || $('#content').text();
  var splitFile = fileName.split('.');
  var ext = splitFile[splitFile.length-1];

  var plain = CryptoJS.AES.decrypt(content, password).toString(CryptoJS.enc.Utf8);

  $('#message').hide();

  var a = $('#downloadButton');

  if([ 'jpg', 'png', 'gif', 'jpeg' ].indexOf(ext) !== -1) {
    var image = btoa(plain);
    $('#image').attr('src', 'data:image/'+ ext +';base64,' + image);
    $('#image').show();
    $('#content').hide()

    a.attr('href', 'data:image/'+ ext +';base64,'+image);
  } else {
    $('#content').html(htmlEntities(plain).replace(/\s/g, '&nbsp;').replace(/\n/g, '<br />'));
    a.attr('href', 'data:text/plain;base64,'+plain);
  }

  a.show()
  a.attr('download', fileName);
  $('#decryptThings').hide();
}

// https://css-tricks.com/snippets/javascript/htmlentities-for-javascript/
function htmlEntities(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
