import './App.css';
import { useRef, useState } from 'react';
import { RealtimeTranscriber } from 'assemblyai/streaming';
import * as RecordRTC from 'recordrtc';

function App() {
  const ASSEMBLY_AI_TOKEN = '3a9c101349a64410b734947dbe1ef7a2'; // Replace with your actual AssemblyAI token

  const realtimeTranscriber = useRef(null);
  const recorder = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const startTranscription = async () => {
    setErrorMessage('');
    console.log("Starting transcription with token:", ASSEMBLY_AI_TOKEN);

    realtimeTranscriber.current = new RealtimeTranscriber({
      token: ASSEMBLY_AI_TOKEN,
      sampleRate: 16000,
    });

    const texts = {};
    realtimeTranscriber.current.on('transcript', transcript => {
      let msg = '';
      texts[transcript.audio_start] = transcript.text;
      const keys = Object.keys(texts);
      keys.sort((a, b) => a - b);
      for (const key of keys) {
        if (texts[key]) {
          msg += ` ${texts[key]}`;
        }
      }
      setTranscript(msg);
    });

    realtimeTranscriber.current.on('error', event => {
      console.error('Error:', event);
      setErrorMessage(`Error: ${event.message || 'Unknown error'}`);
      realtimeTranscriber.current.close();
      realtimeTranscriber.current = null;
    });

    realtimeTranscriber.current.on('close', (code, reason) => {
      console.log(`Connection closed: ${code} ${reason}`);
      if (code === 4001) {
        setErrorMessage('Not authorized: Check your token.');
      } else {
        setErrorMessage(`Connection closed: ${code} ${reason}`);
      }
      realtimeTranscriber.current = null;
    });

    try {
      await realtimeTranscriber.current.connect();
    } catch (error) {
      console.error('Connection error:', error);
      setErrorMessage(`Connection error: ${error.message}`);
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        recorder.current = new RecordRTC(stream, {
          type: 'audio',
          mimeType: 'audio/webm;codecs=pcm',
          recorderType: RecordRTC.StereoAudioRecorder,
          timeSlice: 250,
          desiredSampRate: 16000,
          numberOfAudioChannels: 1,
          bufferSize: 4096,
          audioBitsPerSecond: 128000,
          ondataavailable: async (blob) => {
            if (!realtimeTranscriber.current) return;
            const buffer = await blob.arrayBuffer();
            realtimeTranscriber.current.sendAudio(buffer);
          },
        });
        recorder.current.startRecording();
      })
      .catch((err) => {
        console.error('Recording error:', err);
        setErrorMessage(`Recording error: ${err.message}`);
      });

    setIsRecording(true);
  };

  const endTranscription = async (event) => {
    event.preventDefault();
    setIsRecording(false);

    if (realtimeTranscriber.current) {
      await realtimeTranscriber.current.close();
      realtimeTranscriber.current = null;
    }

    if (recorder.current) {
      recorder.current.pauseRecording();
      recorder.current = null;
    }
  };

  return (
    <div className="App">
      <header>
        <h1 className="header__title">Real-Time Transcription</h1>
        <p className="header__sub-title">Try AssemblyAI's new real-time transcription endpoint!</p>
      </header>
      <div className="real-time-interface">
        <p id="real-time-title" className="real-time-interface__title">Click start to begin recording!</p>
        {isRecording ? (
          <button className="real-time-interface__button" onClick={endTranscription}>Stop recording</button>
        ) : (
          <button className="real-time-interface__button" onClick={startTranscription}>Record</button>
        )}
      </div>
      <div className="real-time-interface__message">
        {transcript}
      </div>
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

export default App;
