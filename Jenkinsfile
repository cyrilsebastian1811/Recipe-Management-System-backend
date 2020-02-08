pipeline {
  environment {
    registry = "${env.registry}"
    registryCredential = 'dockerhub'
    giturl="${env.giturl}"
    dockerImage=''
    commit=''
  }
  agent any
  options {
          skipDefaultCheckout(true)
      }
  stages {
      stage('Checkout SCM') {
                 steps {
                     echo '> Checking out the source control ...'
                     checkout scm

                 }
              }
     stage('Cloning Git') {
      steps {
        git branch: 'master',
            credentialsId: 'GitToken',
            url: "${env.giturl}"
        }
   }
    stage('Building image') {
      steps{
        script {
          env.GIT_COMMIT = sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
          dockerImage = docker.build registry + ":${env.GIT_COMMIT}"
        }
      }
    }
    stage('Deploy Image') {
      steps{
        script {
          docker.withRegistry( '', registryCredential ) {
            dockerImage.push()
          }
        }
      }
    }
    stage('Remove Unused docker image') {
      steps{

        sh "docker rmi $registry:${env.GIT_COMMIT}"
      }
    }
  }
}