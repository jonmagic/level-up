# Level Up

This is an AI application for gathering GitHub contributions for an individual for a given time period and turning that data into feedback to help them level up. Use it for yourself. Use it for a teammate. _It's time to level up._

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

## Agents and Tools

The application uses a series of specialized AI agents and tools to analyze GitHub contributions:

### Agents

1. **Search Agent** (`search.ts`)
   - Specialized in finding GitHub contributions within a specified time range
   - Uses the `search_contributions` tool to query GitHub's GraphQL API
   - Returns a structured list of issues, pull requests, and discussions

2. **Fetcher Agent** (`fetcher.ts`)
   - Retrieves detailed information about each contribution
   - Uses specialized tools (`fetch-issue`, `fetch-pull-request`, `fetch-discussion`) to get full context
   - Handles caching of contribution data to optimize performance

3. **Contribution Analyzer Agent** (`contribution-analyzer.ts`)
   - Analyzes individual contributions in detail
   - Evaluates impact, technical quality, collaboration, and alignment with role expectations
   - Provides structured feedback in JSON format
   - Uses a comprehensive rubric for consistent evaluation

4. **Summary Analyzer Agent** (`summary-analyzer.ts`)
   - Synthesizes multiple contribution analyses into a comprehensive report
   - Identifies key strengths, areas for improvement, and standout contributions
   - Generates metrics and trends from the analyzed contributions
   - Provides actionable feedback aligned with role expectations

### Tools

1. **Search Contributions** (`search-contributions.ts`)
   - GraphQL-based tool for searching GitHub contributions
   - Handles pagination and rate limiting
   - Returns structured data about issues, PRs, and discussions

2. **Fetch Issue** (`fetch-issue.ts`)
   - Retrieves detailed information about GitHub issues
   - Includes comments, labels, and metadata
   - Implements caching for performance optimization

3. **Fetch Pull Request** (`fetch-pull-request.ts`)
   - Gets comprehensive data about pull requests
   - Includes reviews, comments, and code changes
   - Handles caching and rate limiting

4. **Fetch Discussion** (`fetch-discussion.ts`)
   - Retrieves detailed information about GitHub discussions
   - Includes comments, answers, and metadata
   - Implements caching for efficiency

### Flow

1. The Search Agent finds all relevant contributions within the specified time range
2. The Fetcher Agent retrieves detailed information for each contribution
3. The Contribution Analyzer Agent evaluates each contribution individually
4. The Summary Analyzer Agent synthesizes all analyses into a comprehensive report

This multi-agent approach allows for:
- Efficient data gathering and caching
- Detailed, context-aware analysis
- Consistent evaluation using standardized rubrics
- Actionable feedback aligned with role expectations

## Roadmap

We have exciting plans to enhance Level Up and make it even more valuable for users and contributors. Here's what's coming:

### Phase 1: Testing & Stability
- Implement comprehensive test coverage for all agents and tools
- Add automated testing for the analysis pipeline
- Improve error handling and validation
- Document testing practices for contributors

### Phase 2: Interactive Chat Experience
- Add a conversational interface for interacting with contribution data
- Enable real-time analysis of individual contributions
- Support dynamic search parameter adjustments
- Implement chat-based summary analysis

### Phase 3: Advanced Agent Architecture
- Transition to a more flexible agent-based system
- Implement dynamic routing between agents
- Add decision-making capabilities to agents
- Improve agent collaboration and communication

### How to Contribute

We welcome contributions from the community! Here are some ways you can help:

1. **Testing & Documentation**
   - Write tests for existing functionality
   - Improve documentation and examples
   - Add usage guides and best practices

2. **Feature Development**
   - Help implement the chat interface
   - Contribute to the agent architecture
   - Add new analysis capabilities

3. **Bug Fixes & Improvements**
   - Report and fix bugs
   - Optimize performance
   - Enhance error handling

To get started:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with your changes

### Future Possibilities

We're exploring several exciting directions for Level Up:

- **Custom Rubrics**: Allow users to define their own evaluation criteria
- **Growth Plan**: Build out a growth plan based on your analysis
- **Team Analysis**: Extend the tool to analyze team contributions and dynamics
