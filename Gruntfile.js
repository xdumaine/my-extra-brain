module.exports = function (grunt) {
  grunt.initConfig({
    lambda_deploy: {
      default: {
        arn: 'arn:aws:lambda:us-east-1:920018820316:function:sendReminder',
        options: {
          profile: 'xdumaine'
        }
      }
    },
    lambda_package: {
      default: {
      }
    }
  });

  // grunt.loadNpmTasks('grunt-contrib-jshint');
  // grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-aws-lambda');

  grunt.registerTask('default', ['lambda_package']);
};
