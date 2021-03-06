angular.module('app.controllers').controller('createPollFundraiserCtrl',function ($scope, $stateParams, $document, $controller, $rootScope, $q, questions, $http, serverConfig, SequentialAjax, attachmentsService, $ionicPopup) {
  $controller('abstractCreatePollCtrl', {$scope: $scope});
  $scope.prepareGroupPicker(true)

  $scope.chooseGroup = function(group){
    $scope.data.group = group
    $scope.data.openChoices = false;
    
    $scope.showSpinner()
    group.loadBankAccount().then(function(){
      $scope.hideSpinner()
      if(group.bankAccount)
        return false

        $ionicPopup.show({
          template: 'Group "'+group.official_name+'" does not have bank account set up yet. You must set up bank account first in order to successfully create a fundraiser.',
          title: 'New Group Fundraiser',
          cssClass: 'popup-by-ionic',
          scope: $scope,
          buttons: [
            { text: 'Cancel' },
            {
              text: 'Setup Bank Account Now',
              type: 'button-positive',
              onTap: function(e) {
                $rootScope.path('/manage-group/'+group.id)
              }
            }
          ]
        });
    })
  }

  $scope.data.title_text = ''
  $scope.data.description_text = ''
  $scope.data.goal_amount = ''
  $scope.data.end_of_event_date = null

  var now = new Date()
  var h = now.getHours()
  h += 1
  if(h == 24)
    h = 0
  var h2 = h+':00'
  if(h2.length == 4)
    h = '0'+h
  $scope.data.end_of_event_hour = h2
  $scope.data.custom_amount_amount_desc = ''

  $scope.hours = []
  for(i=0; i<24; i++){
    var v = i+':00'
    if(v.length == 4)
      v = '0' + v
    $scope.hours.push(v)
  }

  $scope.answers = [{amount_desc: ''}, {amount_desc: ''}]

  $scope.removeAnswer = function(index){
    if($scope.answers.length <= 2)
      $scope.validationAlert('You must provide at least two answers.')
    else
      $scope.answers.splice(index, 1);
  }

  $scope.addAnswer = function(){
    $scope.answers.push({amount_desc: ''})
  }

  var createPollPayment = function(title, description, groupID){
    var data = {
      title: title,
      subject: description,
      type: 'payment_request'} 

    if($scope.sectionsToPublishIn())
      data.group_sections = $scope.sectionsToPublishIn()
      
    var payload = JSON.stringify(data)
    var headers = {headers: {'Content-Type': 'application/json'}}
    return $http.post(serverConfig.url + '/api/v2/groups/'+groupID+'/polls', payload, headers)
  }

  var createPollCrowdfunding = function(title, description, groupID, endOfEventDateTime, goalAmount){
    var crowdfunding_deadline = questions.toBackendUTCDateTimeString(endOfEventDateTime)
    var data = {
      title: title,
      subject: description,
      is_crowdfunding: true,
      crowdfunding_goal_amount: goalAmount,
      crowdfunding_deadline: crowdfunding_deadline,
      type: 'payment_request'} 
      
    if($scope.sectionsToPublishIn())
      data.group_sections = $scope.sectionsToPublishIn()

    var payload = JSON.stringify(data)
    var headers = {headers: {'Content-Type': 'application/json'}}
    return $http.post(serverConfig.url + '/api/v2/groups/'+groupID+'/polls', payload, headers)    
  }

  var addAmountToPayment = function(pollID, amount, amountDesc){
    var data = {payment_amount: amount, 
      value : amountDesc,
      is_user_amount: false}
    var payload = JSON.stringify(data)
    var headers = {headers: {'Content-Type': 'application/json'}}
    return $http.post(serverConfig.url + '/api/v2/polls/'+pollID+'/options', payload, headers)
  }

  var addCustomAmountToPayment = function(pollID, customAmountDesc){
    var data = {value : customAmountDesc,
      is_user_amount: true}
    var payload = JSON.stringify(data)
    var headers = {headers: {'Content-Type': 'application/json'}}
    return $http.post(serverConfig.url + '/api/v2/polls/'+pollID+'/options', payload, headers)
  }

  $scope.showCannotRemoveWarning = function(){
    $scope.validationAlert('It is not possible to edit or remove this answer.')
  }

  $scope.prefillEndOfEventDate = function(){
    if($scope.data.end_of_event_date == null){
      var tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1); 
      tomorrow.setMinutes(0)
      tomorrow.setMinutes(0)
      tomorrow.setSeconds(0)
      $scope.data.end_of_event_date = tomorrow
    }
  }

  $scope.showCrowdfunderAlert = function(){
    if ($scope.data.is_crowdfunding)
    {
      $scope.createIsCrowdfunderAlert('If you reach or exceed your goal amount by the deadline, all of your supporters will be charged. If you do not reach that goal by the deadline, your supporters will not be charged.');
    }
  }



  $scope.validate = function(){
    var title = $scope.data.title_text
    var description = $scope.data.description_text
    var isCrowdfunding = $scope.data.is_crowdfunding
    var goalAmount = Number($scope.data.goal_amount)
    var customAmountEnabled = $scope.data.custom_amount_enabled
    var customAmountDesc = $scope.data.custom_amount_amount_desc

    if(title.length == 0){
      $scope.validationAlert('Title cannot be blank')
      return false
    }   
    if(description.length == 0){
      $scope.validationAlert('Description cannot be blank')
      return false
    }
    if(isCrowdfunding && (isNaN(goalAmount) || goalAmount == 0)){
      $scope.validationAlert('Goal amount must be a positive number, e.g. 400 or 199.99')
      return false
    }
    if(isCrowdfunding &&  goalAmount < 0){
      $scope.validationAlert('Goal amount must be greater than zero')
      return false
    }
    
    if(isCrowdfunding){
      var endOfEventDateTime = $scope.data.end_of_event_date
      if(endOfEventDateTime == null){
        $scope.validationAlert('End of event date cannot be blank')
        return false
      }
      var endOfEventHour = Number($scope.data.end_of_event_hour.split(':')[0])
      endOfEventDateTime.setHours(endOfEventHour)
      var tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      if(endOfEventDateTime < tomorrow){
        $scope.validationAlert('End of event must be at least 24 hours from now.')
        return false
      }
    }

    var isThereNonEmptyAnswerDesc = false
    var answerAmountNotNumber = false
    var answerAmountIsSubzero = false
    $scope.answers.forEach(function(a){
      if(isNaN(Number(a.amount)))
        answerAmountNotNumber = true
      else if(Number(a.amount) < 0)
        answerAmountIsSubzero = true

      if(a.amount_desc.length == 0)
        isThereNonEmptyAnswerDesc = true
    })

    if(answerAmountNotNumber){
      $scope.validationAlert('Answer amount must be a number and cannot be blank.')
      return false      
    }

    if(answerAmountIsSubzero){
      $scope.validationAlert('Answer amount must be greater than zero.')
      return false       
    }

    if(isThereNonEmptyAnswerDesc){
      $scope.validationAlert('Answer description cannot be blank.')
      return false      
    }

    if(customAmountEnabled && customAmountDesc.length == 0){
      $scope.validationAlert('Custom amount description cannot be blank.')
      return false     
    }

    return true
  }

  $scope.send = function(){
    var title = $scope.data.title_text
    var description = $scope.data.description_text
    var isCrowdfunding = $scope.data.is_crowdfunding
    var goalAmount = Number($scope.data.goal_amount)
    var customAmountEnabled = $scope.data.custom_amount_enabled
    var customAmountDesc = $scope.data.custom_amount_amount_desc

    $scope.showSpinner();

    var groupID = $scope.data.group.id

    var createRequest = null
    if(isCrowdfunding){
      var endOfEventDateTime = $scope.data.end_of_event_date
      var endOfEventHour = Number($scope.data.end_of_event_hour.split(':')[0])
      endOfEventDateTime.setHours(endOfEventHour)
      createRequest = createPollCrowdfunding(title, description, groupID, endOfEventDateTime, goalAmount)
    } else 
      createRequest = createPollPayment(title, description, groupID)

    createRequest.then(function(response){
      var pollID = response.data.id
      var sqAjax = new SequentialAjax()
      $scope.answers.forEach(function(answer){
        sqAjax.add(function(){
          return addAmountToPayment(pollID, answer.amount, answer.amount_desc)
        })
      })

      if(customAmountEnabled){
        sqAjax.add(function(){
          return addCustomAmountToPayment(pollID, customAmountDesc)
        })
      }

      sqAjax.add(function(){
        return addCustomAmountToPayment(pollID, "I don't want to donate. Mark as read.")
      })

      sqAjax.add(function(){
          return attachmentsService.add(pollID, $scope.data.attachments)
      })  

      sqAjax.whenDone().then(function(){
        questions.publishPoll(pollID).then(function(response){
          $scope.hideSpinner();
          $rootScope.showToast('Fundraiser successfully created!');
          $scope.updateActivityNewsfeed()
          if(isCrowdfunding)
            $rootScope.path('/payment-polls/crowdfunding-payment-request/'+response.data.id);
          else
            $rootScope.path('/payment-polls/payment-request/'+response.data.id);
        }, function(error){
          $scope.hideSpinner();
          console.log('publish fundraising failed')
          console.log(error)
          $scope.createContentAlert('Failed to publish fundraising: '+JSON.stringify(error))
        })
      }, function(error){
        $scope.hideSpinner();
        console.log('add payment answer failed')
        console.log(error)
        $scope.createContentAlert('Failed to add one of the payment options: '+JSON.stringify(error))
      })

    }, function(error){
      $scope.hideSpinner();
      console.log('Failed to create poll')
      console.log(error)
      if(error.status == 500)
        $scope.createContentAlert('Your group must have a bank account verified before you can publish a fundraiser. Please visit Group Settings to setup and verify bank account information.')
      else if (error.data && error.data.length > 0){
        var msg = error.data[0].message
        $scope.createContentAlert(msg)
      }
      else
      $scope.createContentAlert('Failed to create poll due to: '+JSON.stringify(error))
    })
  }

})