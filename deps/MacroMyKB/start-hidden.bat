set PM2_HOME=.\.pm2

.\node\node.exe node_modules\pm2\bin\pm2 start server/index.js  --no-daemon -i 1 --name mykb --interpreter=".\node\node.exe"

