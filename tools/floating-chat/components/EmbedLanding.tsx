import React, {useEffect, useState} from 'react';
import Head from 'next/head';
import {inhotelProfileOf, isAgentCardUrl} from '../helpers/agent-card';
import {isDev} from '../helpers/config';

// The agent this page chats with when no ?agent_card_url= is given: the
// inHotel Solutions Specialist.
const EXAMPLE_AGENT_CARD_URL =
  'https://b6739ac5-af3d-4cf0-a980-6ad34122f58d.agents.inhotel.io/.well-known/agent-card.json';

// The agents this page chats with when it is asked for one. On a local server
// any agent's card is taken. Where the page is hosted only an inHotel agent's
// is, so a link to it cannot put someone else's agent behind its address.
const isShownHere = (agentCardUrl: string): boolean =>
  isDev(window)
    ? isAgentCardUrl(agentCardUrl)
    : !!inhotelProfileOf(agentCardUrl);

const embedSnippet = (agentCardUrl: string) => `<script
  defer
  src="https://floating-chat.govisit.ai/widget.js"
  data-agent-card-url="${agentCardUrl}"
></script>`;

// What the root URL shows when opened directly rather than as the launcher's
// iframe: the embed code, and the launcher itself.
export default function EmbedLanding() {
  const [agentCardUrl, setAgentCardUrl] = useState('');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      'agent_card_url'
    );
    const url =
      requested && isShownHere(requested) ? requested : EXAMPLE_AGENT_CARD_URL;

    setAgentCardUrl(url);
    const script = document.createElement('script');
    script.src = '/widget.js';
    script.setAttribute('data-agent-card-url', url);
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <main
      style={{
        width: '100%',
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 16px',
        color: '#1f1f1f',
        lineHeight: 1.6,
      }}
    >
      <Head>
        <title>GoVisit Floating Chat</title>
      </Head>
      <h1 style={{fontSize: 28, marginBottom: 8}}>Floating Chat</h1>
      <p>
        A floating chat button for any page, talking to any A2A agent through
        its agent card. It takes the agent the way Focus Chat does, as{' '}
        <code>agent_card_url</code>. The button in the corner is live.
      </p>
      <h2 style={{fontSize: 18, marginTop: 32}}>Embed it</h2>
      <pre
        style={{
          background: '#f5f5f5',
          padding: 16,
          borderRadius: 8,
          overflowX: 'auto',
          fontSize: 13,
        }}
      >
        {agentCardUrl ? embedSnippet(agentCardUrl) : ''}
      </pre>
      <p style={{fontSize: 14, color: '#595959'}}>
        To try another agent here, open this page with{' '}
        <code>?agent_card_url=</code> and its agent card URL. On a local server
        any A2A agent&rsquo;s card works; on this hosted page, an inHotel
        agent&rsquo;s.
      </p>
    </main>
  );
}
