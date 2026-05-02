pipeline{
    agent any
    
    environment{
        DOCKER_REPO             = "chaitanyaaaa/ecommerce-microservices"
        API_GATEWAY_IMAGE       = "${DOCKER_REPO}-api-gateway"
        USER_SERVICE_IMAGE      = "${DOCKER_REPO}-user-service"
        CART_SERVICE_IMAGE      = "${DOCKER_REPO}-cart-service"
        ORDER_SERVICE_IMAGE     = "${DOCKER_REPO}-order-service"
        PRODUCT_SERVICE_IMAGE   = "${DOCKER_REPO}-product-service"
        PAYMENT_SERVICE_IMAGE   = "${DOCKER_REPO}-payment-service"
        TAG = "v1"
        //TAG_UPDATE = "1.${BUILD_NUMBER}"  << use this for image tagging/versioning , im not using it takes a lot of time for pipeline to run since i have slow upload speed :(
    }
    stages{
        // Not using parallel block since i have slow pc but in future ill update the pipeline for faster builds :)
        // also for debugging ill update this stage with builds stage block for each service in future right now ill just test 
        stage("BUILD") {
            steps{
                dir("user-service") {
                    sh "docker build -t ${USER_SERVICE_IMAGE}:${TAG} ."
                }    
                dir("cart-service") {
                    sh "docker build -t ${CART_SERVICE_IMAGE}:${TAG} ."
                }
                dir("order-service") {
                    sh "docker build -t ${ORDER_SERVICE_IMAGE}:${TAG} ."
                }
                dir("product-service") {
                    sh "docker build -t ${PRODUCT_SERVICE_IMAGE}:${TAG} ."
                }
                dir("payment-service") {
                    sh "docker build -t ${PAYMENT_SERVICE_IMAGE}:${TAG} ."
                }
                dir("api-gateway") {
                    sh "docker build -t ${API_GATEWAY_IMAGE}:${TAG} ."
                }
            }
        }
        stage("PUSH") {
            steps {
                withCredentials([usernamePassword(credentialsId:"DockerHub-Creds", usernameVariable:"USER", passwordVariable:"PASS")]) {
                    sh """
                        echo $PASS | docker login -u $USER --password-stdin
                        docker push ${USER_SERVICE_IMAGE}:${TAG}
                        docker push ${CART_SERVICE_IMAGE}:${TAG}
                        docker push ${ORDER_SERVICE_IMAGE}:${TAG}
                        docker push ${PRODUCT_SERVICE_IMAGE}:${TAG}
                        docker push ${PAYMENT_SERVICE_IMAGE}:${TAG}
                        docker push ${API_GATEWAY_IMAGE}:${TAG}
                       """

                }
            }
        }
        stage("DEPLOY") {
            // ill updatet this with helm in comming days for now its just for testing
            steps{
                withCredentials([file(credentialsId:"kubeconfig", variable: "KUBECONFIG")]) {
                    dir("k8s-manifest") {
                        sh """
                            kubectl apply -f namespace.yml
                            kubectl apply -f ./secrets/app-secrets.yml
                            kubectl apply -f ./mongodb/
                            kubectl apply -f ./user-service/
                            kubectl apply -f ./product-service/
                            kubectl apply -f ./cart-service/
                            kubectl apply -f ./order-service/
                            kubectl apply -f ./payment-service/
                            kubectl apply -f ./api-gateway/  
                        """
                        // for now there is no changes in dpl so pods wont restart so adding this, will update the proper updates later with helm
                        sh "kubectl rollout restart deployment -n ecommerce"
                    }
                }
            }
        }
        stage("VERIFY DEPLOYMENT") {
            steps{
                sh """
                    kubectl get svc -n ecommerce
                    kubectl get pods -n ecommerce
                """
            }
        }
    }    
}
