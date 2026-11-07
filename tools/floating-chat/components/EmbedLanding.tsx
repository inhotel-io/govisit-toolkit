import React, {useEffect, useState} from 'react';
import Head from 'next/head';

// The agent this page chats with when no ?agent_card_url= is given: the
// inHotel Solutions Specialist.
const EXAMPLE_AGENT_CARD_URL =
  'https://b6739ac5-af3d-4cf0-a980-6ad34122f58d.agents.inhotel.io/.well-known/agent-card.json';

// The same check the launcher makes. It also means a link to this page cannot
// put someone else's agent behind a govisit.ai address.
const INHOTEL_AGENT_CARD = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.agents\.inhotel\.io\/\.well-known\/agent-card\.json$/i;

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
      requested && INHOTEL_AGENT_CARD.test(requested)
        ? requested
        : EXAMPLE_AGENT_CARD_URL;

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
        A floating chat button for any page, talking to an A2A agent through its
        agent card. It takes the agent the way Focus Chat does, as{' '}
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
        To try another inHotel agent here, open this page with{' '}
        <code>?agent_card_url=</code> and its agent card URL.
      </p>
    </main>
  );
}
