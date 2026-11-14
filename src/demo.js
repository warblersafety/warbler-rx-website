import { Conversation } from '@elevenlabs/client';
import './demo.css';
import './workflow.css';
import './site.css';
import './mock-ehr.css';
import { initMockEhr } from './mock-ehr.js';
import { initVoiceDemo } from './voice-controller.js';
import { initWorkflow } from './workflow-controller.js';

// The SDK is loaded before interaction so its iOS audio listener sees the click.
const workflow = initWorkflow();
const mockEhr = initMockEhr();
initVoiceDemo({
  loadConversation: () => ({ Conversation }),
  getEhrContext: mockEhr.getEhrContext,
  onWorkflowEvent(event) {
    mockEhr.setBrowserBusy(event.type === 'connecting' || event.type === 'connected');
    workflow.onVoiceEvent(event);
    if (event.type === 'analyzing' || event.type === 'result') document.getElementById('workflow-details').open = true;
  },
});

// Keep the design's policy links usable without leaving an active conversation.
document.querySelectorAll('[data-policy]').forEach(link => {
  link.addEventListener('click', event => {
    const dialog = document.getElementById(link.dataset.policy);
    if (!dialog) return;
    event.preventDefault();
    dialog.showModal();
  });
});

const menuToggle = document.querySelector('.menu-toggle');
menuToggle?.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
document.querySelector('#main-nav')?.addEventListener('click', event => {
  if (event.target.closest('a')) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
  }
});
