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
                     sh 'git rev-parse HEAD > commit'
                     echo 'readFile('commit').trim()'

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
          dockerImage = docker.build registry + ": ${commit}"
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
        sh "docker rmi $registry:$BUILD_NUMBER"
      }
    }
  }
}