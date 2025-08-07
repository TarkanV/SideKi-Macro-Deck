// forge.config.js
module.exports = {
    packagerConfig: {
      // This is the magic setting that gives you the uncompressed folder.
      asar: false,
    },
    makers: [], // We leave this empty because we will use the 'package' command
  };