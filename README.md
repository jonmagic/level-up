# Level Up

This is an AI application for gathering contributions for an individual for a given time period and turning that data into feedback to help them level up. Use it for yourself. Use it for a teammate. **Level Up...**

## How this tool works

1. Searches GitHub for contributions made by an individual.
2. Fetches all of the details for each contribution separately.
3. Analyzes all of the details for each contribution based on the role of individual being reviewed (author, commentor, reviewer, etc) and generates a SWOT for that individual.
4. Summarizes all of the SWOT into a single piece of feedback focusing on what is going well and where they could focus to have a larger impact.

## LLM Instructions

Your coding assistant should fetch these urls to understand all of the available APIs:
- https://raw.githubusercontent.com/motdotla/dotenv/refs/heads/master/README.md
- https://raw.githubusercontent.com/octokit/graphql.js/refs/heads/main/README.md
- https://agentkit.inngest.com/llms-full.txt

## Agents

- Agent for search contributions of a user on GitHub. For now this agent will focus on issues created by a specific author for a given time period.
- Agent for analyzing a contribution to determine what is good and what can be improved. For now focus on analyzing the title of the contribution.

## Services

- Service for fetching data from GitHub including searching for Issues, Pull Requests, and Discussions. Later this should include the ability to fetch comments, review comments, diffs, and discussion comment replies.
