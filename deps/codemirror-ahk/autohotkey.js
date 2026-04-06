// CodeMirror, copyright (c) by Marijn Haverbeke and others
// AutoHotkey mode, engineered by Gemini to match VS Code's tmLanguage grammar.
// Version 5: High-fidelity, state-aware tokenizer.
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode("autohotkey", function() {

  var statementKeywords = /^(Break|Continue|Critical|Exit|ExitApp|Gosub|Goto|New|OnExit|Pause|Return|SetBatchLines|Suspend|Thread|Throw|Until|Loop|class|static|super|try|catch|finally|as)\b/i;
  var controlKeywords = /^(If|For|While|Switch|Else|Case|Default|is|in|contains)\b/i;
  var storageKeywords = /^(local|global|static)\b/i;
  var literals = /^(true|false|this)\b/i;
  var builtins = /^(Abs|ACos|ASin|ATan|CallbackCreate|CallbackFree|Ceil|Chr|Click|ClipWait|ComCall|ComObjActive|ComObjGet|ComObjValue|ControlClick|ControlSend|ControlGetText|CoordMode|Cos|DateAdd|DateDiff|DirCopy|DirCreate|DirDelete|DirExist|DirMove|DllCall|Download|DriveGetList|EnvGet|EnvSet|Exit|ExitApp|Exp|FileAppend|FileCopy|FileDelete|FileEncoding|FileExist|FileGetAttrib|FileGetSize|FileGetTime|FileGetVersion|FileMove|FileOpen|FileRead|FileRecycle|FileSelect|FileSetAttrib|FileSetTime|Floor|Format|FormatTime|GetKeyName|GetKeyState|GroupActivate|GroupAdd|GroupClose|Gui|GuiCtrlFromHnd|GuiFromHwnd|HasBase|HasMethod|HasProp|Hotkey|Hotstring|ImageSearch|IniDelete|IniRead|IniWrite|InputBox|InputHook|InStr|IsAlnum|IsAlpha|IsDigit|IsFloat|IsInteger|IsLabel|IsLower|IsNumber|IsObject|IsSetRef|IsSpace|IsTime|IsUpper|IsXDigit|KeyHistory|KeyWait|Ln|Log|LTrim|Max|MenuSelect|Min|Mod|MonitorGet|MonitorGetCount|MouseClick|MouseClickDrag|MouseGetPos|MouseMove|MsgBox|NumGet|NumPut|ObjAddRef|ObjBindMethod|ObjRelease|OnClipboardChange|OnError|OnExit|OnMessage|Ord|OutputDebug|Pause|Persistent|PixelGetColor|PixelSearch|PostMessage|ProcessClose|ProcessExist|ProcessSetPriority|ProcessWait|ProcessWaitClose|Random|RegDelete|RegExMatch|RegExReplace|RegRead|RegWrite|Reload|Round|RTrim|Run|RunAs|RunWait|Send|SendEvent|SendInput|SendMessage|SendMode|SendText|SetCapslockState|SetKeyDelay|SetTimer|SetTitleMatchMode|SetWinDelay|SetWorkingDir|Shutdown|Sin|Sleep|Sort|SoundBeep|SoundPlay|SplitPath|Sqrt|StatusBarGetText|StatusBarWait|StrCompare|StrGet|StrLen|StrLower|StrReplace|StrSplit|StrUpper|SubStr|Suspend|SysGet|Tan|Thread|ToolTip|TraySetIcon|TrayTip|Trim|Type|VerCompare|WinActivate|WinActive|WinClose|WinExist|WinGetClass|WinGetControls|WinGetCount|WinGetID|WinGetList|WinGetPos|WinGetText|WinGetTitle|WinHide|WinKill|WinMaximize|WinMinimize|WinMove|WinRestore|WinSet|WinSetTitle|WinShow|WinWait|WinWaitActive|WinWaitClose)\b/i;
  var isOperatorChar = /[+\-*&%=<>!?|\/.:,]/;

  // Replace the entire tokenBase function with this one:
function tokenBase(stream, state) {
    if (stream.sol()) {
      if (stream.match(/#\w+/)) { state.tokenize = tokenDirective; return "meta"; }
      if (stream.match(/[\^!+#\w_.-]+(?=::)/)) { return "property"; }
    }

    // 1. Check for hexadecimal numbers first.
    if (stream.match(/^0x[0-9a-fA-F]+\b/)) {
        return "number";
    }

    // 2. Check for decimal and float numbers (now correctly handles single digits).
    if (stream.match(/^\d*\.?\d+\b/)) {
        return "number";
    }
    
    var ch = stream.next();

    // Comments, Strings, etc.
    if (ch == ";") { stream.skipToEnd(); return "comment"; }
    if (ch == "/" && stream.eat("*")) { state.tokenize = tokenComment; return tokenComment(stream, state); }
    if (ch == '"' || ch == "'") { state.tokenize = tokenString(ch); return state.tokenize(stream, state); }
    if (ch == '%') { stream.eatWhile(/[\w#_$@]/); stream.eat('%'); return "variable-2"; }
    if (isOperatorChar.test(ch)) { if ((ch == ":" && stream.eat("=")) || (ch == "=" && stream.eat(">"))) { return "operator"; } stream.eatWhile(isOperatorChar); return "operator"; }

    if (/[()\[\]{}]/.test(ch)) {
      return "bracket";
    }

    stream.eatWhile(/[\w_]/);
    var word = stream.current();

    if (state.afterClass) { state.afterClass = false; return "type"; }

    if (statementKeywords.test(word)) { if (word.toLowerCase() === "class") { state.afterClass = true; } return "keyword"; }
    if (controlKeywords.test(word)) return "block-keyword";
    if (storageKeywords.test(word)) return "atom";
    if (literals.test(word)) return "atom";
    if (builtins.test(word)) return "def";

    if (stream.peek() == "(") { return "def"; }
    if (/^__\w+__$/.test(word)) { return "def"; }
    
    if (/^A_/.test(word)) return "builtin";

    return "variable";
}
  
  function tokenDirective(stream, state) { stream.skipToEnd(); state.tokenize = null; return "string"; }
  function tokenString(quote) {
  return function(stream, state) {
    var next;
    while ((next = stream.next()) != null) {
      if (next == quote) {
        state.tokenize = null; // We've found the end of the string
        break;
      }
      if (next == "`") stream.next(); // Handle the escape character
    }
    return "string";
  };
}
  function tokenComment(stream, state) { var maybeEnd = false, ch; while (ch = stream.next()) { if (ch == "/" && maybeEnd) { state.tokenize = null; break; } maybeEnd = (ch == "*"); } return "comment"; }

  return {
    startState: function() { return {tokenize: null, afterClass: false}; },
    token: function(stream, state) {
      if (stream.eatSpace()) return null;
      return (state.tokenize || tokenBase)(stream, state);
    }
  };
});
CodeMirror.defineMIME("text/x-autohotkey", "autohotkey");
});