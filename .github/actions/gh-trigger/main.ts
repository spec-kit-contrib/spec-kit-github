import * as core from "@actions/core";
import * as github from "@actions/github";
import { DEFAULT_AGENT_LOGIN } from "../core/login.ts";
import { noreplyAuthor } from "./author.ts";
import { decide, type EventPayload, type Review, type ReviewThread } from "./trigger.ts";

async function main(): Promise<void> {
  const octokit = github.getOctokit(core.getInput("github-token", { required: true }));
  const { context } = github;

  const listSpecDirectories = async (ref: string): Promise<string[]> => {
    try {
      const { data } = await octokit.rest.repos.getContent({ ...context.repo, path: "specs", ref });
      return Array.isArray(data) ? data.filter((entry) => entry.type === "dir").map((entry) => entry.path) : [];
    } catch (error) {
      if ((error as { status?: number }).status === 404) return [];
      throw error;
    }
  };

  // Resolved state is only in GraphQL. A pull request on this flow has a handful of threads.
  const getThreads = async (pullNumber: number): Promise<ReviewThread[]> => {
    const data = await octokit.graphql<{
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: Array<{
              isResolved: boolean;
              path: string;
              line: number | null;
              originalLine: number | null;
              comments: { nodes: Array<{ databaseId: number; body: string; author: { login: string; __typename: string } | null }> };
            }>;
          };
        };
      };
    }>(
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
          reviewThreads(first: 100) { nodes { isResolved path line originalLine
            comments(first: 100) { nodes { databaseId body author { login __typename } } } } }
        } }
      }`,
      { ...context.repo, number: pullNumber },
    );
    return data.repository.pullRequest.reviewThreads.nodes.map((thread) => ({
      path: thread.path,
      line: thread.line ?? thread.originalLine,
      isResolved: thread.isResolved,
      comments: thread.comments.nodes.map((comment) => ({
        id: comment.databaseId,
        login: comment.author?.login ?? "",
        userType: comment.author?.__typename ?? "",
        body: comment.body,
      })),
    }));
  };

  const getReviews = async (pullNumber: number): Promise<Review[]> => {
    const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, { ...context.repo, pull_number: pullNumber });
    return reviews.map((review) => ({
      login: review.user?.login ?? "",
      userType: review.user?.type ?? "",
      state: review.state,
      commitId: review.commit_id ?? "",
    }));
  };

  const getPermission = async (login: string): Promise<string> => {
    try {
      const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({ ...context.repo, username: login });
      return data.permission;
    } catch (error) {
      if ((error as { status?: number }).status === 404) return "none";
      throw error;
    }
  };

  const decision = await decide({
    eventName: context.eventName,
    payload: context.payload as unknown as EventPayload,
    githubLogin: core.getInput("github-login"),
    agentLogin: core.getInput("agent-login") || DEFAULT_AGENT_LOGIN,
    listSpecDirectories,
    getThreads,
    getReviews,
    getPermission,
    getPullRequest: async (number) => {
      const { data } = await octokit.rest.pulls.get({ ...context.repo, pull_number: number });
      return {
        headRepo: data.head.repo?.full_name ?? "",
        headRef: data.head.ref,
        headSha: data.head.sha,
        author: data.user?.login ?? "",
      };
    },
  });

  if (!decision.run) {
    core.info(`skipped: ${decision.reason}`);
    core.setOutput("run", "false");
    core.setOutput("reason", decision.reason);
    return;
  }
  // Commits are made as the login that starts the flow, so GitHub shows that account on them.
  // When it cannot be resolved the output stays empty and git-commit uses its default.
  let author = "";
  const login = core.getInput("github-login");
  if (login) {
    try {
      const { data } = await octokit.rest.users.getByUsername({ username: login });
      author = noreplyAuthor(data.login, data.id);
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
      core.warning(`could not find the user ${login}, commits will use the default author`);
    }
  }

  core.setOutput("run", "true");
  core.setOutput("author", author);
  core.setOutput("command", decision.command);
  core.setOutput("ref", decision.ref);
  core.setOutput("prompt", decision.prompt);
  core.setOutput("branch", decision.branch);
  core.setOutput("feature-directory", decision.featureDirectory);
  core.setOutput("number", String(decision.number));
  core.setOutput("threads", decision.threads.join(","));
}

main().catch((error: unknown) => core.setFailed(error instanceof Error ? error.message : String(error)));
