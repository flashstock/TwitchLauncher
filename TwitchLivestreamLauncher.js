var https    = require('https');
var readline = require('readline')
var sys      = require('sys')
var exec     = require('child_process').exec;
var spawn    = require('child_process').spawn;
var child;
var fs       = require('fs');
var async    = require('async');
var config;

run();

function getUsername() {
	return config['username'];
}

function getStreamQuality() {
	return config['streamquality'];
}

function loadConfigFile() {
	console.log("Loading config file");
	var configFile = fs.readFileSync('./tlslconfig.json', 'utf8');
	config = JSON.parse(configFile);
	console.log("Config file loaded");
}

function run() {
	loadConfigFile();
	console.log("Username: " + getUsername());
	console.log("Stream quality: " + getStreamQuality());

	getFollowedChannels(checkIfOnline);
}

function getFollowedChannels(callback) {
	var names = [];

	https.get('https://api.twitch.tv/kraken/users/' + getUsername() + '/follows/channels?limit=100', function(res) {
	console.log("Getting followed channels");
	var data = '';
	res.on('data', function(d) {
		data += d;
	});
	res.on('end', function() {
		var jsonData = JSON.parse(data);
		console.log("Checking if channels are online");

		for (i = 0; i < jsonData['follows'].length; i++) {
			names[i] = jsonData['follows'][i]['channel']['name'];
		}
		callback(names);

	});

	}).on('error', function(e) {
	  console.error(e);
	});
}



function readInputFromConsole(streams) {
	var rl = readline.createInterface({
	  input: process.stdin,
	  output: process.stdout
	});

	console.log();

	for (i = 0; i < streams.length; i++)
			console.log((i) + ': ' + streams[i]['channel']['name'] + ' is online, ' + streams[i]['channel']['status']);

	rl.question("\nWhat stream would you like to watch? Enter a number\n> ", function(answer) {
		var chosenStream = streams[parseInt(answer)]['channel']['name'];
		
		console.log("User chose: " + chosenStream);
		
		child = spawn('livestreamer', ['twitch.tv/' + chosenStream, getStreamQuality()]);
		
		console.log("Starting livestreamer process");

		child.stdout.setEncoding('utf8');
		
		child.stdout.on('data', function(data) {
			if (data != null)
				process.stdout.write(data);
		});

		child.on('close', function (code) {
    		console.log('process exit code ' + code);
		});


	});

}

function checkIfOnline(names) {
	var max = names.length;

	if (max == 0)
		return;

	var onlineCheck = function(name, doneCallback) {
		https.get('https://api.twitch.tv/kraken/streams/' + name, function(res) {
			var data = '';
			res.on('data', function(d) {
				data += d;
			});

			res.on('end', function() {
				var jsonData = JSON.parse(data);
				if (jsonData['stream'] != null) {
					return doneCallback(null, jsonData['stream']);
				}
				return doneCallback(null, null);
			});
		});
	}

	async.map(names, onlineCheck, function(err, data) {
		data = data.filter(function(n){ return n != undefined });
		readInputFromConsole(data);
	});
}
