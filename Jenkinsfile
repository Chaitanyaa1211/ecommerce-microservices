pipeline{
    agent any
    
    environment{
        DOCKER_REPO             = "chaitanyaaaa/ecommerce-microservices"
        DOCKER_BUILDKIT       	= "0"
    	BUILDX_NO_DEFAULT_ATTESTATIONS = "1"
	
	API_GATEWAY_IMAGE       = "${DOCKER_REPO}-api-gateway"
        USER_SERVICE_IMAGE      = "${DOCKER_REPO}-user-service"
        CART_SERVICE_IMAGE      = "${DOCKER_REPO}-cart-service"
        ORDER_SERVICE_IMAGE     = "${DOCKER_REPO}-order-service"
        PRODUCT_SERVICE_IMAGE   = "${DOCKER_REPO}-product-service"
        PAYMENT_SERVICE_IMAGE   = "${DOCKER_REPO}-payment-service"
        TAG = "1.${BUILD_NUMBER}"
        HELM_RELEASE            = "ecommerce"
        HELM_CHART              = "./helm/ecommerce"
        NAMESPACE               = "ecommerce"
    }
    stages{
        // Not using parallel block since i have slow pc but in future ill update the pipeline for faster builds :)
        // also for debugging ill update this stage with builds stage block for each service in future right now ill just test 
        stage("BUILD") {
            steps {
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
            steps {
                withCredentials([file(credentialsId: "kubeconfig", variable: "KUBECONFIG")]) {
                    sh """
                        export KUBECONFIG=$KUBECONFIG
                        helm upgrade --install ${HELM_RELEASE} ${HELM_CHART} \
                            --namespace ${NAMESPACE} \
                            --create-namespace \
                            --set apiGateway.image.tag=${TAG} \
                            --set userService.image.tag=${TAG} \
                            --set productService.image.tag=${TAG} \
                            --set cartService.image.tag=${TAG} \
                            --set orderService.image.tag=${TAG} \
                            --set paymentService.image.tag=${TAG}
                    """
                }
            }
        }
        stage("VERIFY DEPLOYMENT") {
            steps{
                 withCredentials([file(credentialsId:"kubeconfig", variable: "KUBECONFIG")]) {
                    sh """
                        export KUBECONFIG=$KUBECONFIG
                        kubectl get all -n ecommerce
                       """
                }
            }

        }
    }    
}
