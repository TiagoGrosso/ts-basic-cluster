Everyone is more than welcome to contribute to this repository.

You can create issues for feature requests or bugs that you encountered or you can clone/fork the repo and open a PR for one of the reported issues.

## General Guidelines

-   This is a Typescript repository.
-   As the name `basic-cluster` implies, this is a library about providing a simple way of creating a cluster to run tasks in parallel. Submissions unrelated to that mission will not be accepted.
-   If you're ensure about how you should structure something, feel free to ask!

## Style

### Commits

This repo follows [Conventional Commits](https://www.conventionalcommits.org/). This is enforced via a commit-message hook and a mandatory PR check.

To help you follow Conventional Commits, you can use `npm run commit` to build your commit message.

### Formatting

This repo is formatted using Prettier to minimize differences between files and bloated commit diffs from style changes. A `.prettier` file is provided in the repo and you should integrate Prettier in your editor. In case your editor does not support Prettier, execute `npm run format` when you want to format your code.

The format checker runs on all Pull Requests.

### Testing

This repo uses Jest for testing. You can run all unit tests with coverage by executing `npm run test`. The idea is that Test Coverage remains at 100% even though test coverage checks have been preemptively reduced to 95% to take into account some unforeseen functionality that might be hard to test and the proposed changes are urgent.

Creating new tests should be pretty self-explanatory: just follow the already existing structure on the test repo.
