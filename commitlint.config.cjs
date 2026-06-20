// DeskCloud 모노레포 commitlint — fleet 표준(conventional + 본문 라인 ≤100).
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [2, 'always', 100],
  },
};
