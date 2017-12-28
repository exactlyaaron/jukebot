import React, { Component } from "react";
import socketIOClient from "socket.io-client";
import YouTube from 'react-youtube';
import YTSearch from 'youtube-api-search'
import VoiceRecognition from './components/VoiceRecognition'
import css from './App.css';
import Fuse from 'fuse.js';
// import VoicePlayer from './VoicePlayer'
import logo from './assets/logo.svg';

class App extends Component {

  constructor() {
    super();
    this.state = {
      // response: false,
      // endpoint: "http://127.0.0.1:3000",
      introduced: false,
      foundVideos: false,
      suggestedVideos: false,
      hinted: false,
      chatHistory: [
        {
          type: 'chat',
          user: 'juke',
          text: 'Hello, I am jukebot. I can find music videos for you! Tap the mic to begin speaking.'
        }
      ]
    };
  }

  componentDidMount() {
    this.socket = socketIOClient();
    this.socket.on('bot reply', this.handleReply);
  }

  componentDidUpdate(){
    this.scrollToBottom();
  }

  handleReply = (data) => {
    if( data.result && data.result.fulfillment && data.result.fulfillment.speech ){
      if( data.result.action && data.result.action == 'pick-video' ){
        if( !parseInt(data.result.parameters['number-integer']) ){
          return (
            this.setState({
              chatHistory: [...this.state.chatHistory, {type: 'chat', user: 'juke', text: 'Please say a number.'}],
            })
          )
        }
        if( parseInt(data.result.parameters['number-integer']) > 5 ){
          return (
            this.setState({
              chatHistory: [...this.state.chatHistory, {type: 'chat', user: 'juke', text: 'Sorry, I can only handle numbers 5 or under.'}],
            })
          )
        }
      }
      var reply = data.result.fulfillment.speech;
      if( data.result.action && data.result.action == 'find_artist' && !this.state.hinted ){
        reply = reply + ' Hint: you can say the name or number of the video :)'
      }
      this.setState({
        chatHistory: [...this.state.chatHistory, {type: 'chat', user: 'juke', text: reply}],
      });
    } else {
      this.setState({
        chatHistory: [...this.state.chatHistory, {type: 'chat', user: 'juke', text: 'Sorry, I didnt understand that command.'}],
      });
      return;
    }
    if( data.result.action && data.result.action == 'find_artist' ){
      if(data.result.parameters && data.result.parameters.artist){
        YTSearch({key: 'AIzaSyDIkz36G-hOqUnLSyg34y8IdLOwoz4q-Fs', term: data.result.parameters.artist}, (videos) => {
          var stateChat = this.state.chatHistory;
          this.setState({
            videos: videos,
            foundVideos: true,
            listening: false,
            chatHistory: [...this.state.chatHistory, {type: 'video-list', videos: videos}]
          });
        });
      }
    }

    if( data.result.action && data.result.action == 'pick-video' ){
      if( this.state.videos ){
        if( data.result.parameters && data.result.parameters['number-integer'] ){
          if( parseInt(data.result.parameters['number-integer']) <= 5 ){
            this.showVideo(parseInt(data.result.parameters['number-integer']))
          }
        }
      } else {
        this.setState({
          chatHistory: [...this.state.chatHistory, {type: 'chat', user: 'juke', text: 'You need to search for some videos first. Try saying, "search for (artist)" '}],
        });
      }
    }
  }

  showVideo = (num, clicked=false) => {
    if( clicked ){
      this.setState({
        chatHistory: [...this.state.chatHistory, {type: 'chat', user: 'juke', text: 'Enjoy your video'}],
      });
    }
    this.setState({
      chatHistory: [...this.state.chatHistory, {type: 'video', user: 'juke', videoId: this.state.videos[num-1].id.videoId}]
    });
  }

  renderVideoList = () => {
    let videos = [];
    let stylez = {
      display: 'block',
      color: 'red'
    }
    if( this.state.videos ){
      this.state.videos.map((vid, key)=>{
        return videos.push(
          <span
            className="video-title"
            style={stylez}
            key={key}
          >
            {key+1}: {this.state.videos[key].snippet.title}
          </span>
        )
      });
      return videos;
    } else {
      return null;
    }
  }

  startListening = () => {
    if(this.state.introduced == false){
      this.setState({introduced: true})
    }
    this.setState({ listening: true })
    this.refs.vr.start();
    return null;
  }

  onStart = () => {
    this.setState({ transcript: undefined })
  }

  onResult = ({ interimTranscript, finalTranscript }) => {
    const result = finalTranscript
    this.setState({ transcript: finalTranscript })
  }

  scrollToBottom = () => {
    var objDiv = document.getElementById("child-chats");
    if( objDiv.scrollTop != objDiv.scrollHeight ){
      setTimeout(function(){
        var objDiv = document.getElementById("child-chats");
        objDiv.scrollTop = objDiv.scrollHeight;
      },100)
    }
  }

  onEnd = () => {
    if(this.state.transcript){
      this.setState({
        chatHistory: [...this.state.chatHistory, {type: 'chat', user: 'user', text: this.state.transcript}]
      })
      // TODO: if videos are already found, see if they said a video title

      // if last chat was video or video is playing
      if( this.state.chatHistory[this.state.chatHistory.length - 2].type == 'video' || this.state.videoPlaying ){
        var options = {
          includeScore: true,
          threshold: 0.6,
          keys: ['command']
        }
        var pauseCommands = [
          {command: 'pause'},
          {command: 'stop'}
        ]
        var playCommands = [
          {command: 'play'},
          {command: 'resume'}
        ]
        if( this.state.videoPlaying ){
          // pause
          var pauseFuse = new Fuse(pauseCommands, options);
          var pauseResults = pauseFuse.search(this.state.transcript);
          if( pauseResults.length > 0 ){
            // PAUSE VIDEO
            return this.pauseVideo(this.state.youtube);
          }
        } else {
          //resume
          var playFuse = new Fuse(playCommands, options);
          var playResults = playFuse.search(this.state.transcript);
          if( playResults.length > 0 ){
            // RESUME VIDEO
            return this.resumeVideo(this.state.youtube);
          }
        }
      }
      if( this.state.videos ){
        var vids = this.state.videos.map(function(vid, index){
          return {id: index + 1, title: vid.snippet.title}
        })
        var options2 = {
          includeScore: true,
          threshold: 0.25,
          keys: ['title']
        }
        var fuse2 = new Fuse(vids, options2);
        var results2 = fuse2.search(this.state.transcript);
        if( results2.length > 0 ){
          this.setState({ listening: false })
          return this.showVideo(results2[0].item.id)
        }
      }
      // otherwise send out chat
      this.socket.emit('chat message', { context: 'pick-video', msg: this.state.transcript});
    } else {
      this.setState({
        chatHistory: [...this.state.chatHistory, {user: 'juke', type: 'chat', text: 'Sorry, I didnt hear anything. Try saying something like, "Play videos by Dragonforce."'}]
      })
    }

    this.setState({ listening: false })
  }

  _onVideoStart = () => {
    this.setState({videoPlaying: true})
  }

  _onVideoStop = () => {
    this.setState({videoPlaying: false})
  }

  resumeVideo = (target) => {
    this.setState({
      listening: false,
      chatHistory: [...this.state.chatHistory, {user: 'juke', type: 'chat', text: "Let's get this video going :)"}]
    })
    target.playVideo();
  }

  pauseVideo = (target) => {
    this.setState({
      listening: false,
      chatHistory: [...this.state.chatHistory, {user: 'juke', type: 'chat', text: 'I paused the video for you. Say something like "Play video" to resume.'}]
    })
    target.pauseVideo();
  }

  _onReady(event) {
    // access to player in all event handlers via event.target
    this.setState({ youtube: event.target });
  }

  renderChats = () => {
    return (
      <div className="chats" id="child-chats">
        {this.state.chatHistory.map(function(chat, index){
          if( chat.type == 'chat' ){
            return (
              <div key={index+1} className={'chat-bubble '+chat.user}>{chat.text}</div>
            )
          }

          if( chat.type == 'video-list' ){
            return (
              <div key={index+1} className={'video-suggestions'}>
                { chat.videos.map(function(vid, index){
                  return (
                    <div className="video-suggestion" key={'vid'+index} onClick={() => this.showVideo(index+1, true)}>
                      <span className="vid-number">{index + 1}</span> {vid.snippet.title}
                    </div>
                  )
                }.bind(this)) }
              </div>
            )
          }

          if( chat.type == 'video' ){
            const opts = {
              height: '200',
              width: '100%',
              playerVars: { // https://developers.google.com/youtube/player_parameters
                autoplay: 0
              }
            };
            return (
              <div className="video" key={chat.videoId}>
                <YouTube
                  ref={'yt'}
                  videoId={chat.videoId}
                  opts={opts}
                  onReady={this._onReady.bind(this)}
                  onPlay={this._onVideoStart}
                  onPause={this._onVideoStop}
                  onEnd={this._onVideoStop}
                />
              </div>
            )
          }
        }.bind(this))}
        {(this.state.listening || false) &&
          <div key={0} className={'chat-bubble user'}>
            <div className="dot one"></div>
            <div className="dot two"></div>
            <div className="dot three"></div>
          </div>
        }
      </div>
    )
  }

  render() {
    return (
      <div style={{ textAlign: "center" }} id=''>
        <div className="mobile-logo-wrapper">
          <img src={logo} alt="" className="mobile-logo"/>
        </div>
        <div className="chatbot-wrapper">
          <VoiceRecognition
            ref={'vr'}
            continuous={false}
            onStart={this.onStart}
            onEnd={this.onEnd}
            onResult={this.onResult}
          />
        <div className="chatbot-content" id="parent-chats">
            {this.renderChats()}
            { !this.state.introduced &&
              <div className="intro">
                Welcome to jukeBot! <br />
              <span className="light">Tap the mic and say something like: <br/> <span className="example-text">"Find me videos by Dream Theater"</span></span>
              </div>
            }
          </div>
          <div className={this.state.listening ? 'chatbot-button listening' : 'chatbot-button'} onClick={this.startListening.bind(this)}></div>
        </div>
      </div>
    );
  }
}
export default App;
