// Userscript functions.
(function(window, document) {

// Map symbols to key codes.
// Edit this to change keys. Beware your changes won't persist if the
// userscript updates.
var keyMap = {
  'NUM_0': "96",
  'NUM_1': "97",
  'NUM_2': "98",
  'NUM_3': "99",
  'NUM_4': "100",
  'NUM_5': "101",
  'NUM_6': "102",
  'NUM_7': "103",
  'NUM_8': "104",
  'NUM_9': "105",
  '/': "111",
  '*': "106",
  '-': "109",
  '+': "107",
  '.': "110"
};

// Reverse keyMap.
var keyCodes = Object.keys(keyMap).reduce(function (keyCodes, symbol) {
  var val = keyMap[symbol];
  keyCodes[val] = symbol;
  return keyCodes;
}, {});

// This dummy input will handle macro keypresses
var btn = document.createElement("input");
btn.style.opacity = 0;
btn.style.position = "absolute";
btn.style.top = "-100px";
btn.style.left = "-100px";
btn.id = "macro-handler";
document.body.appendChild(btn);

btn.focus();
btn.addEventListener('keydown', keydownHandler, false);
document.addEventListener('keydown', documentKeydown, false);
if (typeof tagpro !== 'undefined') tagpro.ready(function() {
  // Additional delay is for compatibility with chat enhancer.
  setTimeout(showInfo("TagPro Neomacro Plus Loaded!"),1000);
}); else {
  setTimeout(showInfo("TagPro Neomacro Plus Loaded!"),3000);
}

// Checks for macro inputs associated with TagPro NeoMacro and
// Watball's macro generator.
var conflictCheck = setInterval(function() {
  var input = document.getElementById("macrohandlerbutton");
  if (input !== null) {
    // Clean up changes.
    document.removeEventListener('keydown', documentKeydown, false);
    var thisInput = document.getElementById("macro-handler");
    thisInput.removeEventListener('keydown', keydownHandler, false);
    thisInput.remove();
    // Add listener to existing input, assumes focus is handled in
    // other script.
    input.addEventListener('keydown', keydownHandler, false);
    clearInterval(conflictCheck);
  }
}, 200);

// Given a string of keys pressed, parse it into an object to be
// turned into a message, or throw an exception if invalid.
function parseMacro(str) {
  if (str) {
    return Macro.parse(str);
  }
}

function validFirst(keyCode) {
  return Macro.firsts.indexOf(keyCodes[keyCode]) !== -1;
}

var allowedKeys = Object.keys(keyCodes);

function validKey(keyCode) {
  return allowedKeys.indexOf(keyCode.toString()) !== -1;
}

function controlsDisabled() {
  return $("input#chat").is(":visible");
}

// Prevent macro keys from impacting tagpro play.
if (typeof tagpro !== 'undefined') {
  tagpro.ready(function() {
    tagpro.ready(function() {
      function keyNotInUse(k) {
        return !validKey(k);
      }
      for (var key in tagpro.keys) {
        tagpro.keys[key] = tagpro.keys[key].filter(keyNotInUse);
      }
    });
  });
}

function documentKeydown(event) {
  if (!controlsDisabled()) {
    // The handler button should be always focused
    document.getElementById("macro-handler").focus();

    // Disables
    // * backspace
    // * ctrl - to prevent leaving page accidentally
    // * numpad 4 - because it is tied to right navigation.
    if ((event.keyCode==8 || event.ctrlKey || event.keyCode == 100) && !controlsDisabled()) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }
}

// Main macro keypresses handler
// Last time key was pressed.
var lastKey = 0;
// Time to wait after last keypress before trying macro, maximum time before
// macro will go after pressing keys.
var keypressLimit = 3e3;

// The . key on the numpad.
var resetKey = keyMap["."];

// Keys pressed.
var keys = [];
var clearKeys;
function keydownHandler(event) {
  if (controlsDisabled()) return;
  // Reset key in case user presses incorrect key.
  if (event.keyCode == resetKey) {
    keys = [];
    showInfo("Key combination reset! You can restart your macro now.");
    if (clearKeys) {
      clearTimeout(clearKeys);
    }
    return;
  }

  // If no sequence has started and this doesn't match a valid start
  // token, then disregard.
  if (keys.length === 0 && !validFirst(event.keyCode)) return;
  
  // Ignore irrelevant keys and don't allow them to interfere with the
  // macro key sequence.
  if (!validKey(event.keyCode)) return;
  // Remove existing macro parsing to be called if it exists.
  if (clearKeys) {
    clearTimeout(clearKeys);
  }

  event.preventDefault();
  event.stopPropagation();

  keys.push(keyCodes[event.keyCode]);

  // Parse already-pressed keys if no other keys come in.
  try {
    var result = parseMacro(keys.join(" "));
    var message = {
      text: parseMessage(result),
      global: false
    };
    chat(message);
    keys = [];
  } catch(e) {
    //console.debug("Parse error: " + e);
    // Not ready, clear keys after time period.
    clearKeys = setTimeout(function() {
      showInfo("Try your macro again.");
      keys = [];
    }, keypressLimit);
  }
}

/**
 * Send a message.
 * @param {object} chatMessage - The message information. It has
 *   properties `text` and `global` corresponding to the message
 *   to send and whether it should go to everyone (as opposed to
 *   just the user's own team.)
 * @param {boolean} group - Whether this message should be sent
 *   to the group.
 */
var lastMessage = 0;
var messageLimit = 300;
const teamChat  = 84; // T
const allChat   = 13; // enter
const groupChat = 71; // G
const sendChat  = 13; // enter
var e = $.Event('keydown');
function chat(chatMessage, group) {
  if (typeof group == "undefined") group = false;
  var now = Date.now();
  var timeDiff = now - lastMessage;
  if (timeDiff > messageLimit) {
    if (typeof tagpro !== 'undefined') {
      if (!group) {
        tagpro.socket.emit("chat", {
          message: chatMessage.text,
          toAll: chatMessage.global
        });
      } else {
        tagpro.group.socket.emit("chat", chatMessage);
      }
    } else {
      // Blur (unfocus)  the 'name' input box, if you are in the middle of changing your name
      if ( $("#name").is(":focus") ) $("#name").blur();

      // Open the chatbox, if it isn't already
      if ( !$("input#chat").is(":visible") ) {
        if (group) e.keyCode = groupChat;
        else       e.keyCode = chatMessage.global ? allChat : teamChat;
        $(document).trigger(e);
      }

      // enter the message
      $("input#chat").val(chatMessage.text);

      // send the message
      e.keyCode = sendChat;
      $(document).trigger(e);
    }
    lastMessage = Date.now();
  } else if (timeDiff >= 0) {
    setTimeout(function() {
      chat(chatMessage, group);
    }, messageLimit - timeDiff);
  }
}

// Show feedback to user.
function showInfo(message) {
  if (typeof io !== "undefined" && io.__loopback &&
    typeof tagpro !== "undefined") {
    tagpro.socket.emit("local:chat", {
      to: "all",
      from: null,
      message: "TNP: " + message
    });
  } else {
    var chat = $("<div><span class='message'></span></div>").clone();
    chat.text("TNP: " + message);
    $("div#chatHistory").append(chat).scrollTop($("div#chatHistory").get(0).scrollHeight);
    setTimeout(function() {
        chat.remove();
    }, 2e4);
    if ( ! $("div#chatHistory").is(':visible') ) {
      console.warn("TNP: Cannot show info. You are probably using a script that replaces the default chat.\n\n" + message);
    }
  }
}

var Symbols = {};
Symbols.directions = {
  "sw": "\u21d9",
  "s": "\u21d3",
  "se": "\u21d8",
  "w": "\u21d0",
  "c": "\u2a00",
  "e": "\u21d2",
  "nw": "\u21d6",
  "n": "\u21d1",
  "ne": "\u21d7"
};

// Text expansions for macro values.
var Shorthand = {
  // Directions.
  "sw": "bottom left",
  "s": "bottom",
  "se": "bottom right",
  "w": "left",
  "c": "middle",
  "e": "right",
  "nw": "top left",
  "n": "top",
  "ne": "top right",
  // Powerups.
  "jj": "juke juice",
  "tp": "tagpro",
  "rb": "rolling bomb",
  "ts": "top speed",
  // Pronouns.
  "self": "I",
  "enemy": "enemy",
  "teammate": "teammate"
};

// Operation that can be applied in templates.
var Operations = {
  expand: function(val) {
    return Shorthand[val];
  },
  dir: function(val) {
    return Symbols.directions[val];
  },
  capitalize: function(val) {
    return val.slice(0, 1).toUpperCase() + val.slice(1);
  },
  dbl: function(val) {
    return val + val;
  }
};

// Sentences that the parsed key strokes are placed into.
var Templates = {
  "fc_position": "{{loc|dir|dbl}} Enemy FC is {{loc|expand}} {{loc|dir|dbl}}",
  "pup_grabbed": "{{who|expand|capitalize}} got {{what|expand}} on {{where|expand}} @ :{{when}}",
  "pup_time": "{{where|expand}} powerup @ :{{when}}",
  "fc_position_lane": "Enemy FC is {{lane}}.",
  "pup_respawn": "{{where|expand|capitalize}} powerup is respawning soon.",
  "base_status": "Number of enemies in base: {{num}}"
};

// Given text from within a replacement, parse it.
function parseReplacement(replacement, info) {
  var vals = replacement.split("|");
  var out = info[vals[0]];
  var fns = vals.slice(1);
  fns.forEach(function(fn) {
    if (Operations.hasOwnProperty(fn)) {
      out = Operations[fn].call(null, out);
    }
  });
  return out;
}

// TODO: Transition to jison-backed parser?
// Parse message information into sentence for output.
function parseMessage(info) {
  var template = Templates[info.type];
  var literal_re = /(?:(.*?)(\{\{))|(?:.*)/g;
  var replace_re = /(.*?)?\}\}/g;
  var tok = literal_re.exec(template);
  var tok_type = "literal";
  var tok_stream = [];
  var out = "";
  while (tok !== null) {
    if (tok_type == "literal") {
      // Start of replacement found.
      if (tok[2]) {
        out += tok[1];
        replace_re.lastIndex = literal_re.lastIndex;
        tok = replace_re.exec(template);
        tok_type = "replacement";
      } else {
        // No replacements found.
        // Append text if matched.
        out += tok[0];  
        break;
      }
    } else {
      // Replacement.
      if (tok.length == 2) {
        // Replacement text found.
        out += parseReplacement(tok[1], info);
        literal_re.lastIndex = replace_re.lastIndex;
        tok = literal_re.exec(template);
        tok_type = "literal";
      }
    }
  }
  return out;
}

})(window, document);
