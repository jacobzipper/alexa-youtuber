'use strict';

var Alexa = require('alexa-sdk');
var constants = require('./constants');
var request = require('request');
var linkfinder = require('./youtube/lib/linkfinder');
var knox = require('knox');
var crypto = require('crypto');
var users = {};
var client = knox.createClient({
    key: process.env.aws_key
  , secret: process.env.aws_secret
  , bucket: 'youtuberzipper'
});
var http = require('http');
var getURL = function (input,callback) {
    input = input.replace(/\s+$/,'');
    if (!input) return "";
    var detailsfunc = input.search(/https?:\/\//) == 0 ? linkfinder.getLink : linkfinder.find;
    detailsfunc(input, function (error, details) {
        if (error) return "";
	return callback(details);
    });
};
var audioData = {
    title: 'Youtuber'
};

var stateHandlers = {
    'GetVideoIntent': function () {
        var devid = this.event.context.System.device.deviceId+"";
        console.log(devid);
        if (users[devid] == undefined) {
            users[devid] = {};
            users[devid]["songs"] = [];
            users[devid]["cursor"] = 0;
        }
        var slotVal = isSlotValid(this.event.request,"vid");
        var ye = this;
        if(slotVal == null) {
            this.emit(":tell","you fucked up");
        }
        else {
            console.log(slotVal);
            request('https://youtube.com/results?search_query='+slotVal,function(err,resp,data){
                if (data) {
                    var id = data.substring(data.indexOf("/watch?v=")+9,data.indexOf("/watch?v=")+20);
                    console.log(id);
                    var url = "https://youtube.com/watch?v="+id;
                    var hash = crypto.createHash('md5').update(url).digest('hex');
                    var found = false;
                    client.list({},function(err, data){
                        for(var i = 0; i < data["Contents"].length; i++) {
                            if (data["Contents"][i]["Key"]==hash+".mp3") {
                                console.log("found");
                                found = true;
                                break;
                            }
                        }
                        if(found) {
                            audioData.url = "https://s3.amazonaws.com/youtuberzipper/"+hash+".mp3";
                            users[devid]["songs"].push("https://s3.amazonaws.com/youtuberzipper/"+hash+".mp3");
                            console.log(audioData.url);
                            ye.emit('PlayAudio');
                        }
                        else {
                            getURL(url,function(res) {
                                http.get(res.url, function(result){
                                    var headers = {
                                          'Content-Length': result.headers['content-length']
                                        , 'Content-Type': result.headers['content-type']
                                    };
                                    client.putStream(result, '/'+hash+'.mp3', headers, function(err, res){
                                        audioData.url = "https://s3.amazonaws.com/youtuberzipper/"+hash+".mp3";
                                        console.log(audioData.url);
                                        ye.emit('PlayAudio');
                                    });
                                });
                            });
                        }
                    });
                }
            });
        }
    },
    'QueueVideoIntent': function () {
        var devid = this.event.context.System.device.deviceId+"";
        console.log(devid);
        if (users[devid] == undefined) {
            users[devid] = {};
            users[devid]["songs"] = [];
            users[devid]["cursor"] = 0;
        }
        var slotVal = isSlotValid(this.event.request,"vid");
        var ye = this;
        if(slotVal == null) {
            this.emit(":tell","you fucked up");
        }
        else {
            console.log(slotVal);
            request('https://youtube.com/results?search_query='+slotVal,function(err,resp,data){
                if (data) {
                    var id = data.substring(data.indexOf("/watch?v=")+9,data.indexOf("/watch?v=")+20);
                    console.log(id);
                    var url = "https://youtube.com/watch?v="+id;
                    var hash = crypto.createHash('md5').update(url).digest('hex');
                    var found = false;
                    client.list({},function(err, data){
                        for(var i = 0; i < data["Contents"].length; i++) {
                            if (data["Contents"][i]["Key"]==hash+".mp3") {
                                console.log("found");
                                found = true;
                                break;
                            }
                        }
                        if(found) {
                            audioData.url = "https://s3.amazonaws.com/youtuberzipper/"+hash+".mp3";
                            users[devid]["songs"].push("https://s3.amazonaws.com/youtuberzipper/"+hash+".mp3");
                            console.log(audioData.url);
                            ye.response.speak("Added to your queue");
                            ye.emit(":responseReady");
                        }
                        else {
                            getURL(url,function(res) {
                                http.get(res.url, function(result){
                                    var headers = {
                                          'Content-Length': result.headers['content-length']
                                        , 'Content-Type': result.headers['content-type']
                                    };
                                    client.putStream(result, '/'+hash+'.mp3', headers, function(err, res){
                                        audioData.url = "https://s3.amazonaws.com/youtuberzipper/"+hash+".mp3";
                                        console.log(audioData.url);
                                        ye.response.speak("Added to your queue");
                                        ye.emit(":responseReady");
                                    });
                                });
                            });
                        }
                    });
                }
            });
        }
    },
    'PlayAudio': function () {
        // play the radio
        controller.play.call(this, this.t('WELCOME_MSG', { skillName: audioData.title } ));
        var devid = this.event.context.System.device.deviceId+"";
        users[devid]["cursor"] += 1;
        console.log("played song " + (users[devid]["cursor"] - 1));
    },
    'AMAZON.HelpIntent': function () {
        this.response.listen(this.t('HELP_MSG', { skillName: audioData.title } ));
        this.emit(':responseReady');
    },
    'SessionEndedRequest': function () {
        // No session ended logic
    },
    'ExceptionEncountered': function () {
        console.log("\n******************* EXCEPTION **********************");
        console.log("\n" + JSON.stringify(this.event.request, null, 2));
        this.callback(null, null)
    },
    'Unhandled': function () {
        this.response.speak(this.t('UNHANDLED_MSG'));
        this.emit(':responseReady');
    },
    'AMAZON.NextIntent': function () {
        this.emit('PlayAudio');
    },
    'AMAZON.PreviousIntent': function () {
        var devid = this.event.context.System.device.deviceId+"";
        users[devid]["cursor"] -= 2;
        this.emit('PlayAudio');
    },

    'AMAZON.PauseIntent':   function () { this.emit('AMAZON.StopIntent'); },
    'AMAZON.CancelIntent':  function () { this.emit('AMAZON.StopIntent'); },
    'AMAZON.StopIntent':    function () {
        var devid = this.event.context.System.device.deviceId+"";
        if (users[devid] == undefined) {
            users[devid] = {};
            users[devid]["songs"] = [];
            users[devid]["cursor"] = 0;
        }
        else {
            users[devid]["songs"] = [];
            users[devid]["cursor"] = 0;
        }
        controller.stop.call(this, this.t('STOP_MSG'))
    },

    'AMAZON.ResumeIntent':  function () { controller.play.call(this, this.t('RESUME_MSG')) },

    'AMAZON.LoopOnIntent':     function () { this.emit('AMAZON.StartOverIntent'); },
    'AMAZON.LoopOffIntent':    function () { this.emit('AMAZON.StartOverIntent');},
    'AMAZON.ShuffleOnIntent':  function () {
        this.response.speak(this.t('NOT_POSSIBLE_MSG'));
        this.emit(':responseReady');
    },
    'AMAZON.ShuffleOffIntent': function () {
        this.response.speak(this.t('NOT_POSSIBLE_MSG'));
        this.emit(':responseReady');
    },
    'AMAZON.StartOverIntent':  function () {
        var devid = this.event.context.System.device.deviceId+"";
        users[devid]["cursor"] -= 1;
        this.emit('PlayAudio');
    },

    /*
     *  All Requests are received using a Remote Control. Calling corresponding handlers for each of them.
     */
    'PlayCommandIssued':  function () { controller.play.call(this, this.t('WELCOME_MSG', { skillName: audioData.title } )) },
    'PauseCommandIssued': function () { controller.stop.call(this, this.t('STOP_MSG')) }
}

var audioEventHandlers =  {
    'PlaybackStarted' : function () {
        /*
         * AudioPlayer.PlaybackStarted Directive received.
         * Confirming that requested audio file began playing.
         * Do not send any specific response.
         */
        console.log("Playback started");
        this.attributes['token'] = getToken.call(this);
        this.attributes['index'] = getIndex.call(this);
        this.attributes['playbackFinished'] = false;
        this.emit(':responseReady');
    },
    'PlaybackFinished' : function () {
        /*
         * AudioPlayer.PlaybackFinished Directive received.
         * Confirming that audio file completed playing.
         * Do not send any specific response.
         */
        console.log("Playback finished");
        this.emit(':responseReady');
    },
    'PlaybackStopped' : function () {
        /*
         * AudioPlayer.PlaybackStopped Directive received.
         * Confirming that audio file stopped playing.
         */
        console.log("Playback stopped");

        //do not return a response, as per https://developer.amazon.com/docs/custom-skills/audioplayer-interface-reference.html#playbackstopped
        this.emit(':responseReady');
    },
    'PlaybackNearlyFinished' : function () {
        /*
         * AudioPlayer.PlaybackNearlyFinished Directive received.
         * Replacing queue with the URL again.
         * This should not happen on live streams
         */
        console.log("Playback nearly finished");
        var enqueueIndex = this.attributes['index'];
        enqueueIndex +=1;
        this.attributes['enqueuedToken'] = String(this.attributes['playOrder'][enqueueIndex]);
        var enqueueToken = this.attributes['enqueuedToken'];
        var expectedPreviousToken = this.attributes['token'];
        //this.response.audioPlayerPlay('REPLACE_ALL', audioData.url, audioData.url, null, 0);
        var devid = this.event.context.System.device.deviceId+"";
        console.log(devid);
        if(users[devid] != undefined) {
            console.log("enqueueing");
            this.response.audioPlayerPlay('ENQUEUE', users[devid]["songs"][users[devid]["cursor"]], enqueueToken, expectedPreviousToken, 0);
            users[devid]["cursor"] += 1;
        }
        this.emit(':responseReady');
    },
    'PlaybackFailed' : function () {
        /*
         * AudioPlayer.PlaybackFailed Directive received.
         * Logging the error and restarting playing.
         */
        console.log("Playback Failed : %j", this.event.request.error);
        this.response.audioPlayerClearQueue('CLEAR_ENQUEUED');
        this.emit(':responseReady');
    }
};

module.exports.stateHandlers = stateHandlers;
module.exports.audioEventHandlers = audioEventHandlers;

var controller = function () {
    return {
        play: function (text) {
            /*
             *  Using the function to begin playing audio when:
             *      Play Audio intent invoked.
             *      Resuming audio when stopped/paused.
             *      Next/Previous commands issued.
             */
            var devid = this.event.context.System.device.deviceId+"";
            if (users[devid] == undefined) {
                this.response.speak("There was an error. Restart youtuber please.");
                this.emit(":responseReady");
            }
            else {
                if(users[devid]["cursor"] < 0) {
                    users[devid]["cursor"] = 0;
                    this.response.speak("You requested to play a previous song when there are none. I will play the first song in the queue.").audioPlayerPlay('REPLACE_ALL', users[devid]["songs"][users[devid]["cursor"]], users[devid]["songs"][users[devid]["cursor"]], null, 0);
                }
                else if(users[devid]["cursor"] < users[devid]["songs"].length) {
                    this.response.speak(text).audioPlayerPlay('REPLACE_ALL', users[devid]["songs"][users[devid]["cursor"]], users[devid]["songs"][users[devid]["cursor"]], null, 0);
                }
                else {
                    users[devid]["cursor"] -= 1;
                    this.response.speak("There are no more songs in your queue. Playing the last song.").audioPlayerPlay('REPLACE_ALL', users[devid]["songs"][users[devid]["cursor"]], users[devid]["songs"][users[devid]["cursor"]], null, 0);

                }
                this.emit(':responseReady');
            }
        },
        stop: function (text) {
            /*
             *  Issuing AudioPlayer.Stop directive to stop the audio.
             *  Attributes already stored when AudioPlayer.Stopped request received.
             */
            this.response.speak(text).audioPlayerStop();
            this.emit(':responseReady');
        }
    }
}();

function canThrowCard() {
    /*
     * To determine when can a card should be inserted in the response.
     * In response to a PlaybackController Request (remote control events) we cannot issue a card,
     * Thus adding restriction of request type being "IntentRequest".
     */
    if (this.event.request.type === 'IntentRequest' || this.event.request.type === 'LaunchRequest') {
        return true;
    } else {
        return false;
    }
}

function isSlotValid(request, slotName){
        var slot = request.intent.slots[slotName];
        //console.log("request = "+JSON.stringify(request)); //uncomment if you want to see the request
        var slotValue;

        //if we have a slot, get the text and store it into speechOutput
        if (slot && slot.value) {
            //we have a value in the slot
            slotValue = slot.value.toLowerCase();
            return slotValue;
        } else {
            //we didn't get a value in the slot.
            return false;
        }
}

function getToken() {
    // Extracting token received in the request.
    return this.event.request.token;
}

function getIndex() {
    // Extracting index from the token received in the request.
    var tokenValue = parseInt(this.event.request.token);
    return this.attributes['playOrder'].indexOf(tokenValue);
}

function getOffsetInMilliseconds() {
    // Extracting offsetInMilliseconds received in the request.
    return this.event.request.offsetInMilliseconds;
}

module.exports.getURL = getURL;
