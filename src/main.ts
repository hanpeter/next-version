import * as core from '@actions/core'
import concat from 'concat-stream'
import conventionalCommitsParser from 'conventional-commits-parser'
import gitSemverTags from 'git-semver-tags'
import gitRawCommits from 'git-raw-commits'
import {whatBump} from './what-bump'
import {outputVersion} from './output-version'
import * as semver from 'semver'

async function run(): Promise<void> {
  try {
    const path = core.getInput('path')
    const prefix = core.getInput('prefix') || 'v'
    const tagPrefix = core.getInput('tag-prefix') || 'v'
    const skipUnstable = core.getInput('skip-unstable') === 'true'

    gitSemverTags(
      {
        tagPrefix,
        skipUnstable
      },
      (err, tags) => {
        if (!tags || !tags.length) {
          core.warning('No tags')
          core.setOutput('release-type', 'patch')
          core.setOutput('bumped', true)
          outputVersion('current-version', prefix, '0.0.0')
          outputVersion('version', prefix, '0.0.1')
          return
        }

        gitRawCommits({
          format: '%B%n-hash-%n%H',
          from: tags[0].toString() || '',
          path
        })
          .pipe(conventionalCommitsParser())
          .pipe(
            concat(data => {
              const commits = data

              const currentVersion = semver.clean(tags[0].toString()) || '0.0.0'

              if (!commits || !commits.length) {
                core.warning('No commits since last release')
                core.setOutput('release-type', 'none')
                core.setOutput('bumped', false)
                outputVersion('current-version', prefix, currentVersion)
                outputVersion('version', prefix, currentVersion)
                return
              }

              const result = whatBump(commits)
              const nextVersion =
                semver.inc(currentVersion, result.releaseType) || '0.0.1'

              core.setOutput('release-type', result.releaseType)
              core.setOutput('bumped', true)
              outputVersion('current-version', prefix, currentVersion)
              outputVersion('version', prefix, nextVersion)
            })
          )
      }
    )
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
