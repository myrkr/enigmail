// Uses: chrome://enigmail/content/enigmailCommon.js
// Uses: chrome://global/content/nsUserSettings.js

var gCaptureWebMail = nsPreferences.getBoolPref(ENIGMAIL_PREFS_ROOT+"captureWebMail");

dump("enigmailNavigatorOverlay.js: gCaptureWebMail="+gCaptureWebMail+"\n");

if (gCaptureWebMail) {
   // Initialize enigmailCommon etc.
   EnigInitCommon();
   window.addEventListener("load", enigNavigatorStartup, true);
}

var gEnigCurrentSite;
var gEnigNavButton1;
var gEnigCurrentHandlerNavButton1;
var gEnigTest = true;

function enigNavigatorStartup() {
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigNavigatorStartup:\n");
  var contentArea = document.getElementById("appcontent");
  contentArea.addEventListener("load",   enigDocLoadHandler, true);
  contentArea.addEventListener("unload", enigDocUnloadHandler, true);

  gEnigCurrentSite = null;
  gEnigCurrentHandlerNavButton1 = enigConfigWindow;
  gEnigNavButton1 = document.getElementById("enig-nav-button1");
}

function enigHandlerNavButton1()
{
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigHandlerNavButton1:\n");

  if (gEnigCurrentHandlerNavButton1) {
    gEnigCurrentHandlerNavButton1();

  } else {
    DEBUG_LOG("enigmailNavigatorOverlay.js: enigHandlerNavButton1: No button handler!\n");
  }
}

function enigDocLoadHandler(event) {
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigDocLoadHandler:\n");

  enigUpdateUI(_content.location);
}

function enigFrameLoadHandler(event) {
 DEBUG_LOG("enigmailNavigatorOverlay.js: enigFrameLoadHandler: "+event.target.location.href+"\n");
}

function enigFrameUnloadHandler(event) {
 DEBUG_LOG("enigmailNavigatorOverlay.js: enigFrameUnloadHandler: "+event.target.location.href+"\n");
}

function enigDocUnloadHandler(event) {
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigDocUnloadHandler: Next URL="+event.target.location.href+"\n");

  enigUpdateUI(_content.location);

  if (event.target == _content.document) {
      // Handle events for content document only
    DEBUG_LOG("enigmailNavigatorOverlay.js: enigDocUnloadHandler: Main doc\n");
  }
}

function enigConfigWindow() {
  DEBUG_LOG("enigmailNavigatorOverlay.js: enigConfigWindow:\n");
  toOpenWindowByType("tools:enigmail", "chrome://enigmail/content/enigmail.xul");
}

function enigResetUI() {
  gEnigCurrentSite = null;
  gEnigNavButton1.setAttribute("hidden", "true");
}

function enigUpdateUI(loc) {

  DEBUG_LOG("enigmailNavigatorOverlay.js: enigUpdateUI: "+loc.href+"\n");

  var host;
  try {
    // Extract hostname from URL (lower case)
    host = loc.host.toLowerCase();

  } catch(ex) {
    enigResetUI();
    return;
  }

  if (host.search(/mail.yahoo.com$/) != -1) {
    gEnigNavButton1.setAttribute("hidden", "false");
    gEnigCurrentSite = "mail.yahoo.com";
    enigYahooUpdateUI();

  } else if (host.search(/hotmail.msn.com$/) != -1) {
    gEnigNavButton1.setAttribute("hidden", "false");
    gEnigCurrentSite = "hotmail.msn.com";
    enigHotmailUpdateUI();

  } else if (loc.href.search(/^file:/) != -1) {
    gEnigCurrentSite = "TEST";
    if (gEnigTest) {
      gEnigTest = false;
      enigTest();
    }

  } else {
    enigResetUI();
  }
}

// *** YAHOO SPECIFIC STUFF ***

function enigYahooUpdateUI() {

  DEBUG_LOG("enigmailYahoo.js: enigYahooUpdateUI:\n");

  var msgFrame = enigYahooLocateMessageFrame();
  DEBUG_LOG("msgFrame.name = "+msgFrame.name+"\n")

  // Extract pathname from message frame URL
  var pathname = msgFrame.location.pathname;

  DEBUG_LOG("pathname = "+pathname+"\n");

  if (pathname.search(/ShowLetter$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigYahooShowLetter;
    gEnigNavButton1.label = "Decrypt/Verify";

  } else if (pathname.search(/Compose$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigYahooCompose;
    gEnigNavButton1.label = "Sign & Encrypt";

  } else {
    gEnigCurrentHandlerNavButton1 = enigConfigWindow;
    gEnigNavButton1.label = "Enigmail";
  }
}

function enigYahooLocateMessageFrame() {
  DEBUG_LOG("enigmailYahoo.js: enigYahooLocateMessageFrame:\n");

  var msgFrame;

  if (_content.frames.length) {
    // Locate message frame
    for (var j=0; j<_content.frames.length; j++) {
      DEBUG_LOG("frame "+j+" = "+_content.frames[j].name+"\n");
      if (_content.frames[j].name == "wmailmain")
        msgFrame = _content.frames[j];
    }
  } else {
    msgFrame = _content;
  }

  return msgFrame;
}

function enigYahooCompose() {
  DEBUG_LOG("enigmailYahoo.js: enigYahooCompose:\n");

  var msgFrame = enigYahooLocateMessageFrame();

  var plainText = msgFrame.document.Compose.Body.value;
  DEBUG_LOG("enigYahooCompose: plainText="+plainText+"\n");

  var toAddr = msgFrame.document.Compose.To.value;
  DEBUG_LOG("enigYahooCompose: To="+toAddr+"\n");

  var statusCodeObj = new Object();
  var statusMsgObj = new Object();
  var cipherText = EnigEncryptMessage(plainText, toAddr,
                                      statusCodeObj, statusMsgObj);

  var statusCode = statusCodeObj.value;
  var statusMsg  = statusMsgObj.value;

  if (statusCode != 0) {
    EnigAlert("Error in encrypting and/or signing message.\n"+statusMsg);
    return;
  }

  msgFrame.document.Compose.Body.value = cipherText;

}


function enigYahooShowLetter() {
  DEBUG_LOG("enigmailYahoo.js: enigYahooShowLetter:\n");

  var msgFrame = enigYahooLocateMessageFrame();

  var preElement = msgFrame.document.getElementsByTagName("pre")[0];

  //DEBUG_LOG("enigYahooShowLetter: "+preElement+"\n");

  var cipherText = EnigGetDeepText(preElement);

  DEBUG_LOG("enigYahooShowLetter: cipherText='"+cipherText+"'\n");

  var statusCodeObj = new Object();
  var statusMsgObj = new Object();
  var plainText = EnigDecryptMessage(cipherText, statusCodeObj, statusMsgObj);

  var statusCode = statusCodeObj.value;
  var statusMsg  = statusMsgObj.value;

  if (statusCode != 0) {
    EnigAlert("Error in decrypting message.\n"+statusMsg);
    return;
  }

  while (preElement.hasChildNodes())
      preElement.removeChild(preElement.childNodes[0]);

  var newTextNode = msgFrame.document.createTextNode(plainText);
  preElement.appendChild(newTextNode);
  
}

// *** HOTMAIL SPECIFIC STUFF ***

function enigHotmailUpdateUI() {

  DEBUG_LOG("enigmailHotmail.js: enigHotmailUpdateUI:\n");

  var msgFrame = enigHotmailLocateMessageFrame();
  DEBUG_LOG("msgFrame.name = "+msgFrame.name+"\n")

  // Extract pathname from message frame URL
  var pathname = msgFrame.location.pathname;

  DEBUG_LOG("pathname = "+pathname+"\n");

  if (pathname.search(/getmsg$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigHotmailShowLetter;
    gEnigNavButton1.label = "EnigShow";

  } else if (pathname.search(/compose$/) != -1) {
    gEnigCurrentHandlerNavButton1 = enigHotmailCompose;
    gEnigNavButton1.label = "EnigCompose";

  } else {
    gEnigCurrentHandlerNavButton1 = null;
    gEnigNavButton1.label = "EnigMoz";
  }
}

function enigHotmailLocateMessageFrame() {
  DEBUG_LOG("enigmailHotmail.js: enigHotmailLocateMessageFrame:\n");

  return _content;
}


function enigHotmailCompose() {
  DEBUG_LOG("enigmailHotmail.js: enigHotmailCompose:\n");

  var msgFrame = enigHotmailLocateMessageFrame();

  var plainText = msgFrame.document.composeform.body.value;
  DEBUG_LOG("enigHotmailCompose: plainText="+plainText+"\n");

  var toAddr = msgFrame.document.composeform.to.value;
  DEBUG_LOG("enigHotmailCompose: To="+toAddr+"\n");

  var statusCodeObj = new Object();
  var statusMsgObj = new Object();
  var cipherText = EnigEncryptMessage(plainText, toAddr,
                                      statusCodeObj, statusMsgObj);

  var statusCode = statusCodeObj.value;
  var statusMsg  = statusMsgObj.value;

  if (statusCode != 0) {
    EnigAlert("Error in encrypting and/or signing message.\n"+statusMsg);
    return;
  }

  msgFrame.document.composeform.body.value = cipherText;

}


function enigHotmailShowLetter() {
  DEBUG_LOG("enigmailHotmail.js: enigHotmailShowLetter:\n");

  var msgFrame = enigHotmailLocateMessageFrame();

  var preElement = msgFrame.document.getElementsByTagName("pre")[0];

  //DEBUG_LOG("enigHotmailShowLetter: "+preElement+"\n");

  var cipherText = EnigGetDeepText(preElement);

  DEBUG_LOG("enigHotmailShowLetter: cipherText='"+cipherText+"'\n");

  var statusCodeObj = new Object();
  var statusMsgObj = new Object();
  var plainText = EnigDecryptMessage(cipherText, statusCodeObj, statusMsgObj);

  var statusCode = statusCodeObj.value;
  var statusMsg  = statusMsgObj.value;

  if (statusCode != 0) {
    EnigAlert("Error in decrypting message.\n"+statusMsg);
    return;
  }

  while (preElement.hasChildNodes())
      preElement.removeChild(preElement.childNodes[0]);

  var newTextNode = msgFrame.document.createTextNode(plainText);
  preElement.appendChild(newTextNode);
}