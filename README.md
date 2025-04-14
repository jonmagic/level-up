# Level Up

This is an AI application for gathering contributions for an individual for a given time period and turning that data into feedback to help them level up. Use it for yourself. Use it for a teammate. **Level Up...**

- Typescript/nodenext/esm/vitest/dotenv.
- Clean code, no semi-colons, other nice default code styles via eslint and prettier.
- Use @inngest/agent-kit (see https://agentkit.inngest.com/llms-full.txt for API docs) under the hood and start with OpenAI for the LLM.
- Octokit rest and graphql to search for and fetch Issues, Pull Requests, Discussions, comments, comment replies for discussions, diff entries and PR reviews for Pull Requests.
- TUI that takes in a GitHub user login, a time range, and a job description and uses that to direct the workflow and agents.
- Search for data that should be included, fetch the extra data like comments/diffs/etc, analyze each item to decide whether it should be included and what the individuals role was (author, commenter, reviewer, etc), analyze each of the items that made the cut to do a SWOT analysis based on their role, look at the sum of SWOT analysis to determine the most common themes for things they are doing well and should keep doing and things they could change to better serve themselves, the team, and the company providing a few specific examples (urls) for those themes and format that for their engineering leader who will then write actionable feedback based on the themes.

Your process for implementing this:

- Do not implement everything at once, incrementally introduce little pieces of functionality building up to the final goal.
- Each step should have an easy way to test that it satisfies requirements by either through documentation or running a test or running a script that exercises things end to end.
- After a small set of changes has been confirmed prepare a commit with a semantic commit message.
