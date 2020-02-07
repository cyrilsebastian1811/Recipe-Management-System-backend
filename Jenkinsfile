pipeline {
  environment {
    registry = "puneet2020/webapp-backend"
    registryCredential = 'dockerhub'
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
        git branch: 'a4',
            credentialsId: 'GitToken',
            url: 'https://github.com/puneetneu/webapp-backend.git'
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