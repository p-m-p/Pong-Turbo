<?php

	require 'config.php';
	$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_SCHEMA);

	if (array_key_exists("recordScore", $_POST)) {
		
		$stmt = $conn->prepare(
			'INSERT INTO score (username, score, played_on_date)' .
			'VALUES (?, ?, NOW())'
		);
		if ($stmt) {
			$stmt->bind_param('ss', $_POST['username'], $_POST['score']);
			$stmt->execute();
			$stmt->close();
		}

	} else if (array_key_exists("getScores", $_GET)) {

		$ret = array();
		$stmt = $conn->prepare(
			'SELECT username, score FROM scores ' .
			'ORDER BY score LIMIT 10'
		);
		if ($stmt) {
			$stmt->execute();
			$stmt->bind_result($user, $score);
			while ($stmt->fetch()) {
				array_push($ret, array(
						'user' => $user
					,	'score' => $score
				));
			}
			header($_SERVER['SERVER_PROTOCOL'] . ' 500 Internal Server Error', true, 500);
			header('Content-Type:application/json');
			echo json_encode($ret);
		}

	}
		
	$conn->close();
