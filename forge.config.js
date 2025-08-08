// forge.config.js
module.exports = {
    packagerConfig: {
      // This is the magic setting that gives you the uncompressed folder.
      asar: true,
      extraResource: [
      './deps',
      "./Open Config File.lnk",
    ],
    ignore :[
        '/deps',
        'node_modules',
    ],
    

    },
    makers: [], // We leave this empty because we will use the 'package' command
  };