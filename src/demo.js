import { Conversation } from '@elevenlabs/client';
import './demo.css';
import { initVoiceDemo } from './voice-controller.js';

// Load the SDK before interaction so its iOS audio-unlock listener sees the click.
initVoiceDemo({ loadConversation: () => ({ Conversation }) });
