import React, {useEffect, useState} from 'react';
import Head from 'next/head';
import {useRouter} from 'next/router';
import Widget from '../components/Widget';
import EmbedLanding from '../components/EmbedLanding';

export default function Home() {
  const {query} = useRouter();
  const token = query.token || query.accountId;
  // The launcher's iframe always passes a token. Without one, someone opened
  // the page directly. Read that from the URL on the client: a statically
  // optimised page first renders with an empty query, and the iframe must
  // never render the landing page, which loads the launcher again.
  const [isDirectVisit, setDirectVisit] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDirectVisit(!params.has('token') && !params.has('accountId'));
  }, []);

  return (
    <>
      <Head>
        <title>{query.title || 'Welcome'}</title>
        <link rel="icon" href="/favicon.ico" />
        <base target="_parent _blank"></base>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>

      {token ? (
        <Widget config={query} />
      ) : isDirectVisit ? (
        <EmbedLanding />
      ) : null}
    </>
  );
}
