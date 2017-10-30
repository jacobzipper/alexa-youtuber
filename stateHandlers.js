'use strict';

var Alexa = require('alexa-sdk');
var constants = require('./constants');
var request = require('request');
var linkfinder = require('./youtube/lib/linkfinder');
var knox = require('knox');
var crypto = require('crypto');
var songs = [];
var cursor = 0;
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
                            songs.push("https://s3.amazonaws.com/youtuberzipper/"+hash+".mp3");
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
                            songs.push("https://s3.amazonaws.com/youtuberzipper/"+hash+".mp3");
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
        cursor++;
        console.log("played song " + (cursor -1));
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
        cursor -= 2;
        this.emit('PlayAudio');
    },

    'AMAZON.PauseIntent':   function () { this.emit('AMAZON.StopIntent'); },
    'AMAZON.CancelIntent':  function () { this.emit('AMAZON.StopIntent'); },
    'AMAZON.StopIntent':    function () { controller.stop.call(this, this.t('STOP_MSG')) },

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
        cursor--;
        this.emit('PlayAudio');
    },
    'AudioPlayer.PlaybackFinished': function () {
        this.emit('PlayAudio');
    },

    /*
     *  All Requests are received using a Remote Control. Calling corresponding handlers for each of them.
     */
    'PlayCommandIssued':  function () { controller.play.call(this, this.t('WELCOME_MSG', { skillName: audioData.title } )) },
    'PauseCommandIssued': function () { controller.stop.call(this, this.t('STOP_MSG')) }
}

module.exports = stateHandlers;

var controller = function () {
    return {
        play: function (text) {
            /*
             *  Using the function to begin playing audio when:
             *      Play Audio intent invoked.
             *      Resuming audio when stopped/paused.
             *      Next/Previous commands issued.
             */
            if(cursor < 0) {
                cursor = 0;
                this.response.speak("You requested to play a previous song when there are none. I will play the first song in the queue.").audioPlayerPlay('REPLACE_ALL', songs[cursor], songs[cursor], null, 0);
            }
            else if(cursor < songs.length) {
                this.response.speak(text).audioPlayerPlay('REPLACE_ALL', songs[cursor], songs[cursor], null, 0);
            }
            else {
                this.response.speak("There are no more songs in your queue");

            }
            this.emit(':responseReady');
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
module.exports.getURL = getURL;
