# GoVisit Toolkit

Tools and resources for using [GoVisit](https://govisit.ai) with AI agents and
coding assistants, including Claude Code, Codex, and other compatible tools.

This repository is the home for GoVisit skills, documentation, tools, examples,
and reference implementation guides. Resources will be added incrementally;
see the [agent skills documentation](https://govisit.ai/en/docs/developers/agent-skills/overview)
for existing skill packages and links to their supported interfaces.

## Find your starting point

| Audience | What you can work on |
| --- | --- |
| **Travel Planner** | Discover destinations, research places, and plan trips using published GoVisit information. |
| **Destination** | Prepare destination content updates and manage publication through your destination OU's permissions. |
| **Local Business** | Prepare business-profile recommendations and manage authorized updates to your place profile. |

Skill packages belong under the top-level `skills/` directory. Related tools,
documentation, guides, and reference implementations can live alongside them.

## Licensing

The GoVisit Toolkit's code, skills, scripts, schemas, documentation, and examples
are licensed under the **[MIT License](LICENSE)** unless otherwise indicated.
You can reuse, modify, redistribute, and commercially use these materials under
that license. Preserve the required copyright and license notice when doing so.

Access to GoVisit-hosted search, public read APIs, WebMCP tools, and use of
returned GoVisit Data are governed separately by the
**[GoVisit Data Use License](https://govisit.ai/en/docs/general/data-use-license)**.
The toolkit license grants no additional service capacity, data rights, or editing
permissions. Third-party materials retain their identified licenses and notices.

| Material or activity | Applicable terms |
| --- | --- |
| Toolkit code, skills, schemas, documentation, and examples | MIT, except explicitly identified third-party or separately licensed material |
| Hosted search, public read APIs, WebMCP access, and returned GoVisit Data | GoVisit Data Use License and applicable source-specific terms |
| Submitting recommendations or publishing content updates | Applicable service/submission terms and current account, resource, and role permissions |
| Third-party content | Its identified source terms; inclusion in a response does not make it MIT-licensed |

These are separate scopes. The Data Use License is not an additional restriction
on reuse of the MIT-licensed toolkit files. Conversely, including a client or
schema here does not make the hosted service or its returned data MIT-licensed.

See [Hosted services and data terms](SERVICE_TERMS.md) for the scope of each set
of terms, attribution guidance, and handling of examples and submissions.

## Responsible use

- Follow the documented interfaces, request limits, and any account-specific
  access conditions. Installing a skill does not grant backend permissions.
- Preserve data attribution, provenance, freshness, and source-license notices
  when using GoVisit responses, as required by the applicable terms.
- Use clearly labeled synthetic data in examples where possible. Identify the
  source and applicable terms for any separately licensed fixtures or media.
- Keep credentials, personal information, and confidential business data out of
  public issues, examples, and pull requests.

