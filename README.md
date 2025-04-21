# Level Up

This is an AI application for gathering contributions for an individual for a given time period and turning that data into feedback to help them level up. Use it for yourself. Use it for a teammate. **Level Up...**

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/level-up.git
cd level-up

# Install dependencies
pnpm install
```

## Usage

Run the analyzer using the provided script:

```bash
./script/analyze --organization open-truss \
  --user jonmagic \
  --start-date 2024-03-01 \
  --end-date 2024-03-31 \
  --role-description /path/to/role-description.md
```

### Command Line Options

- `--organization, -o`: GitHub organization to search within
- `--user, -u`: GitHub username to analyze
- `--start-date, -s`: Start date in YYYY-MM-DD format
- `--end-date, -e`: End date in YYYY-MM-DD format
- `--role-description, -r`: Path to a file containing the role description
- `--output-path, -p`: Optional path to save the analysis JSON (if not provided, analysis will only be printed to console)
- `--help, -h`: Show help message

### Examples

```bash
# Using short flags
./script/analyze -o open-truss -u jonmagic -s 2024-03-01 -e 2024-03-31 -r role.md


# Save analysis to a file
./script/analyze -o open-truss -u jonmagic -s 2024-03-01 -e 2024-03-31 -r role.md -p analysis.json
```

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
